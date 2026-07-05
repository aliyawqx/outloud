import { ModelBusyError } from '@/lib/anthropic'
import { isStaff } from '@/lib/appLock'
import { AUTOPILOT_PROMPT } from '@/lib/autopilotPrompt'
import { COST_PER_AUTO_POST } from '@/lib/creditsConfig'
import { deduct, getBalance, InsufficientCreditsError, refund, resetIfDue } from '@/lib/credits'
import { addNotification } from '@/lib/notifications/store'
import { slotOccupied } from '@/lib/schedule/conflict'
import { createScheduledPost } from '@/lib/schedule/store'
import type { SchedulePlatform } from '@/lib/schedule/types'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { generatePost } from '@/lib/voice/generate'
import { isVoiceReady } from '@/lib/voice/ready'
import { listEnabledTexts } from '@/lib/voice/samples'
import { listProfiles } from '@/lib/voice/store'
import { getAccount as getXAccount } from '@/lib/x/store'
import { pauseAutopilot, type AutopilotSettings } from './store'
import { validateAutopilotPost } from './validate'

// One autopilot generation = one slot fill. Reuses the EXISTING voice pipeline
// (generatePost) with the autopilot FORMAT prompt (voice spec) — no second
// voice system. Credits go through the existing deduct/refund helpers.

/** Deterministic daily rotation through the user's interests. */
export function pickInterest(interests: string[], slot: Date): string {
  const day = Math.floor(slot.getTime() / 86_400_000)
  return interests[day % interests.length]
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
  }
  if (connected.length === 0) return 'no_platforms'

  // 3. Credit gate (spec §6a.3): never go negative, never silently fail —
  //    pause + notify instead. Staff are unlimited (existing bypass).
  const staff = isStaff(user.email)
  if (!staff) {
    await resetIfDue(user.userId)
    const balance = await getBalance(user.userId)
    if (balance < COST_PER_AUTO_POST) {
      await pauseAutopilot(user.userId, 'insufficient_credits')
      await addNotification({
        userId: user.userId,
        kind: 'autopilot_paused',
        title: 'autopilot paused — not enough credits',
        body: 'top up in billing to get autopilot writing again.',
      }).catch(() => {})
      return 'paused_credits'
    }
  }

  // 4. The voice: the user's first ready profile (same resolution as the composer).
  const profile = (await listProfiles(user.userId)).find(isVoiceReady) ?? null
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
        await pauseAutopilot(user.userId, 'insufficient_credits')
        await addNotification({
          userId: user.userId,
          kind: 'autopilot_paused',
          title: 'autopilot paused — not enough credits',
          body: 'top up in billing to get autopilot writing again.',
        }).catch(() => {})
        return 'paused_credits'
      }
      throw err
    }
  }

  try {
    const interest = pickInterest(settings.interests, slot)
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

    const post = await createScheduledPost({
      userId: user.userId,
      content: text,
      firstReply: null, // autopilot never carries a link (voice spec)
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
