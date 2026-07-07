import { ModelBusyError } from '@/lib/anthropic'
import { isStaff } from '@/lib/appLock'
import { AUTOPILOT_PROMPT } from '@/lib/autopilotPrompt'
import { COST_PER_AI_PHOTO, COST_PER_AUTO_POST, LOW_CREDIT_POSTS_LEFT } from '@/lib/creditsConfig'
import { deduct, getBalance, InsufficientCreditsError, refund, resetIfDue } from '@/lib/credits'
import { addNotification, hasRecentNotification } from '@/lib/notifications/store'
import { slotOccupied } from '@/lib/schedule/conflict'
import { slotRankInDay } from '@/lib/schedule/slots'
import { generateImage } from '@/lib/images/kie'
import { storeImageFromUrl } from '@/lib/images/blob'
import { createScheduledPost } from '@/lib/schedule/store'
import type { ScheduledMedia } from '@/lib/schedule/types'
import type { SchedulePlatform } from '@/lib/schedule/types'
import { getAccount as getLinkedInAccount } from '@/lib/linkedin/store'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { generatePost } from '@/lib/voice/generate'
import { isVoiceReady } from '@/lib/voice/ready'
import { listEnabledTexts } from '@/lib/voice/samples'
import { listProfiles } from '@/lib/voice/store'
import { getAccount as getXAccount } from '@/lib/x/store'
import { pauseForCredits } from './pause'
import { type AutopilotSettings } from './store'
import { maybeAutoTopup } from './autoTopup'
import { validateAutopilotPost } from './validate'

// One autopilot generation = one slot fill. Reuses the EXISTING voice pipeline
// (generatePost) with the autopilot FORMAT prompt (voice spec) — no second
// voice system. Credits go through the existing deduct/refund helpers.

/** Deterministic round-robin through the user's topics. With a slot ordinal
 *  (day * slotsPerDay + rank-in-day) rotation advances every SLOT, so two slots
 *  on the same day never repeat a theme (zero-touch addendum A.3). Without an
 *  ordinal it falls back to the original per-day rotation. */
export function pickInterest(interests: string[], slot: Date, slotOrdinal?: number): string {
  const n = slotOrdinal ?? Math.floor(slot.getTime() / 86_400_000)
  return interests[n % interests.length]
}

export type SlotFillResult =
  | 'generated'
  | 'occupied'
  | 'no_voice'
  | 'no_platforms'
  | 'invalid_output'
  | 'paused_credits'

export async function fillSlot(
  user: { userId: string; email: string },
  settings: AutopilotSettings,
  slot: Date,
): Promise<SlotFillResult> {
  // 1. Autopilot only fills EMPTY slots — any non-cancelled post blocks (spec §2/§7).
  if (await slotOccupied(user.userId, slot)) return 'occupied'

  // 2. Only publish to platforms that are actually connected (skip, don't fail).
  const connected: SchedulePlatform[] = []
  for (const p of settings.platforms) {
    if (p === 'x' && (await getXAccount(user.userId))) connected.push('x')
    if (p === 'threads' && (await getThreadsAccount(user.userId))) connected.push('threads')
    if (p === 'linkedin') {
      // Only a HEALTHY connection counts — needs_reconnect would fail at publish time.
      const li = await getLinkedInAccount(user.userId)
      if (li && li.status === 'connected') connected.push('linkedin')
    }
  }
  if (connected.length === 0) return 'no_platforms'

  // 3. Credit gate (spec §6a.3): never go negative, never silently fail —
  //    pause + notify instead. Staff are unlimited (existing bypass).
  const staff = isStaff(user.email)
  if (!staff) {
    await resetIfDue(user.userId)
    const balance = await getBalance(user.userId)
    if (balance < COST_PER_AUTO_POST) {
      await pauseForCredits(user.userId, user.email) // M9: in-app + email, never silent
      return 'paused_credits'
    }
    // Never stall silently (addendum A.4): warn while autopilot can still post,
    // so the hard pause at zero rarely happens. Auto-topup hook first.
    if (balance < COST_PER_AUTO_POST * LOW_CREDIT_POSTS_LEFT) {
      const topped = await maybeAutoTopup(user.userId)
      if (!topped && !(await hasRecentNotification(user.userId, 'low_credits', 72 * 3_600_000))) {
        await addNotification({
          userId: user.userId,
          kind: 'low_credits',
          title: 'autopilot is running low on credits',
          body: `about ${Math.floor(balance / COST_PER_AUTO_POST)} auto posts left — top up in billing to keep it running.`,
        }).catch(() => {})
      }
    }
  }

  // 4. The voice: the user's ACTIVE ready profile — autopilot must write in the
  //    voice the user actually selected (its captured style guide + samples drive
  //    generation). Falls back to the first ready one if none is marked active.
  const profiles = await listProfiles(user.userId)
  const profile = profiles.find((p) => p.isActive && isVoiceReady(p)) ?? profiles.find(isVoiceReady) ?? null
  if (!profile) return 'no_voice'
  const samples = await listEnabledTexts(user.userId, profile.id, 5)

  // 5. Charge atomically right before generating; refund on ANY failure below
  //    (same pattern as app/api/voice/chat).
  let chargeLedgerId: string | undefined
  if (!staff) {
    try {
      const charge = await deduct(user.userId, COST_PER_AUTO_POST, 'post', {
        metadata: { kind: 'autopilot', slot: slot.toISOString() },
      })
      chargeLedgerId = charge.ledgerId
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        // Balance dropped between the pre-check and the atomic charge (concurrent
        // spend) — same outcome as the credit gate: pause + notify, never crash the run.
        await pauseForCredits(user.userId, user.email)
        return 'paused_credits'
      }
      throw err
    }
  }

  try {
    // Slot ordinal = day * slotsPerDay + rank-in-day → per-slot topic rotation.
    const slotCfg = { postingTimes: settings.postingTimes, timezone: settings.timezone, slotsPerDay: settings.slotsPerDay }
    const slotOrdinal = Math.floor(slot.getTime() / 86_400_000) * settings.slotsPerDay + slotRankInDay(slotCfg, slot)
    const interest = pickInterest(settings.interests, slot, slotOrdinal)
    const { drafts } = await generatePost({
      idea: `share one specific thought, lesson, or observation from your work related to: ${interest}`,
      voiceProfile: profile,
      samples,
      count: 1,
      formatText: AUTOPILOT_PROMPT,
    })

    const text = drafts[0]?.fullText ?? ''
    const check = validateAutopilotPost(text)
    if (!check.ok) {
      // Empty/garbage output is refunded and skipped — NEVER scheduled (spec §6a.4).
      if (chargeLedgerId) await refund(user.userId, chargeLedgerId).catch((e) => console.error('[autopilot] refund failed:', e))
      console.warn('[autopilot] invalid output (%s) for user %s — will retry next cycle', check.reason, user.userId)
      return 'invalid_output'
    }

    // Optional AI image (settings.aiImages): generate → copy to our Blob →
    // charge only after success (same policy as /api/images/generate). An image
    // failure NEVER blocks the post — autopilot must not lose the slot over art.
    let media: ScheduledMedia[] | null = null
    if (settings.aiImages) {
      try {
        if (staff || (await getBalance(user.userId)) >= COST_PER_AI_PHOTO) {
          const tmpUrl = await generateImage(
            `a clean, minimal, abstract editorial illustration (no text, no words) for a social post about: ${interest}`,
          )
          const stored = await storeImageFromUrl(tmpUrl, 'autopilot-images')
          if (!staff) {
            await deduct(user.userId, COST_PER_AI_PHOTO, 'ai_image', {
              metadata: { kind: 'autopilot_image', slot: slot.toISOString() },
            }).catch((e) => console.error('[autopilot] image charge failed:', e))
          }
          media = [{ url: stored.url, alt: `illustration: ${interest}` }]
        }
      } catch (e) {
        console.error('[autopilot] ai image failed (post continues text-only):', e)
      }
    }

    const post = await createScheduledPost({
      userId: user.userId,
      content: text,
      firstReply: null, // autopilot never carries a link (voice spec)
      media,
      platforms: connected,
      scheduledFor: slot,
      timezone: settings.timezone,
      source: 'autopilot',
      creditsCharged: staff ? 0 : COST_PER_AUTO_POST,
      chargeLedgerId: chargeLedgerId ?? null,
    })

    if (settings.reviewBeforePublish) {
      const when = slot.toLocaleString('en-US', {
        timeZone: settings.timezone,
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
      await addNotification({
        userId: user.userId,
        kind: 'autopilot_queued',
        title: 'autopilot queued a post',
        body: `going out ${when} — review or edit it on the calendar first.`,
        refId: post.id,
      }).catch(() => {})
    }
    return 'generated'
  } catch (err) {
    if (chargeLedgerId) await refund(user.userId, chargeLedgerId).catch((e) => console.error('[autopilot] refund failed:', e))
    // Unique-index race: another cron run filled this slot between the occupancy
    // check and the insert — treat as occupied, credits already refunded.
    if ((err as { code?: string })?.code === '23505') return 'occupied'
    if (err instanceof ModelBusyError) throw err // stop the whole run — model is overloaded
    console.error('[autopilot] generation failed for user %s:', user.userId, err)
    return 'invalid_output'
  }
}
