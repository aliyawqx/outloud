import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getUserTier } from '@/lib/billing/tier'
import { getAutopilotSettings, upsertAutopilotSettings, type AutopilotSettingsPatch } from '@/lib/autopilot/store'
import { estimateMonthlyCredits } from '@/lib/autopilot/estimate'
import { isStaff } from '@/lib/appLock'
import { fmtCredits, planAllowance } from '@/lib/creditsConfig'
import { getProfile } from '@/lib/profile/store'
import { parsePlatforms } from '@/lib/schedule/parse'
import { isValidTimeZone, type PostingTime } from '@/lib/schedule/slots'

const MAX_INTERESTS = 20
const INTEREST_MAX_LEN = 80
// No product cap on slots anymore - the credit-budget check below is the real
// limiter (a schedule can't outspend the plan's monthly refill). This is only a
// payload sanity bound: 48 = one slot every half hour, far past any budget.
const MAX_POSTING_TIMES = 48
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function parseInterests(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const out = [...new Set(raw.filter((x): x is string => typeof x === 'string').map((s) => s.trim().slice(0, INTEREST_MAX_LEN)).filter(Boolean))]
  return out.slice(0, MAX_INTERESTS)
}

function parsePostingTimes(raw: unknown): PostingTime[] | null {
  if (!Array.isArray(raw)) return null
  const out: PostingTime[] = []
  for (const t of raw.slice(0, MAX_POSTING_TIMES)) {
    if (!t || typeof t !== 'object') return null
    const time = (t as { time?: unknown }).time
    if (typeof time !== 'string' || !TIME_RE.test(time)) return null
    const rawDays = (t as { days?: unknown }).days
    if (rawDays !== undefined && !Array.isArray(rawDays)) return null
    const days = Array.isArray(rawDays)
      ? [...new Set(rawDays)]
      : undefined
    if (days && !days.every((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)) return null
    out.push({ time, ...(days && days.length ? { days } : {}) })
  }
  return out
}

// GET /api/autopilot — the user's autopilot settings (defaults if never saved).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const settings = await getAutopilotSettings(session.userId)
    return NextResponse.json({ settings })
  } catch (err) {
    console.error('[autopilot] read failed:', err)
    return NextResponse.json({ error: 'Could not load autopilot settings.' }, { status: 500 })
  }
}

// PUT /api/autopilot — update settings (partial; onboarding + settings page).
export async function PUT(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>

  const patch: AutopilotSettingsPatch = {}
  if (b.enabled !== undefined) {
    if (typeof b.enabled !== 'boolean') return NextResponse.json({ error: 'Invalid enabled flag.' }, { status: 400 })
    patch.enabled = b.enabled
  }
  if (b.reviewBeforePublish !== undefined) {
    if (typeof b.reviewBeforePublish !== 'boolean') return NextResponse.json({ error: 'Invalid review flag.' }, { status: 400 })
    patch.reviewBeforePublish = b.reviewBeforePublish
  }
  if (b.aiImages !== undefined) {
    if (typeof b.aiImages !== 'boolean') return NextResponse.json({ error: 'Invalid image flag.' }, { status: 400 })
    patch.aiImages = b.aiImages
  }
  if (b.interests !== undefined) {
    const interests = parseInterests(b.interests)
    if (!interests) return NextResponse.json({ error: 'Invalid interests.' }, { status: 400 })
    patch.interests = interests
  }
  if (b.postingTimes !== undefined) {
    const postingTimes = parsePostingTimes(b.postingTimes)
    if (!postingTimes) return NextResponse.json({ error: 'Invalid posting times.' }, { status: 400 })
    patch.postingTimes = postingTimes
    // Each posting time IS one post per day — the quota is derived, not chosen.
    patch.slotsPerDay = Math.min(MAX_POSTING_TIMES, Math.max(1, postingTimes.length))
  }
  if (b.timezone !== undefined) {
    if (typeof b.timezone !== 'string' || !isValidTimeZone(b.timezone)) {
      return NextResponse.json({ error: 'Invalid timezone.' }, { status: 400 })
    }
    patch.timezone = b.timezone
  }
  if (b.platforms !== undefined) {
    const platforms = parsePlatforms(b.platforms)
    if (!platforms) return NextResponse.json({ error: 'Pick at least one platform.' }, { status: 400 })
    patch.platforms = platforms
  }
  // slotsPerDay is no longer client-settable — it is derived from postingTimes above.
  if (b.leadTimeMinutes !== undefined) {
    if (!Number.isInteger(b.leadTimeMinutes) || (b.leadTimeMinutes as number) < 30 || (b.leadTimeMinutes as number) > 1440) {
      return NextResponse.json({ error: 'Lead time must be 30-1440 minutes.' }, { status: 400 })
    }
    patch.leadTimeMinutes = b.leadTimeMinutes as number
  }
  // Turning autopilot ON requires the essentials to be in place.
  if (patch.enabled) {
    // Autopilot is a Pro feature (trial counts as Pro — plan-gating spec §5).
    // The UI lock is UX; THIS is the enforcement.
    const tier = await getUserTier(session.userId, session.email)
    if (!tier.canUseAutopilot) {
      return NextResponse.json(
        { error: 'Autopilot is a Max feature. Upgrade to turn it on.', needsPro: true },
        { status: 403 },
      )
    }
    const merged = { ...(await getAutopilotSettings(session.userId)), ...patch }
    if (!merged.interests.length) return NextResponse.json({ error: 'Add at least one interest first.' }, { status: 400 })
    if (!merged.postingTimes.length) return NextResponse.json({ error: 'Add at least one posting time first.' }, { status: 400 })
    if (!merged.platforms.length) return NextResponse.json({ error: 'Pick at least one platform first.' }, { status: 400 })
  }

  // The schedule must FIT the plan (mirror of the live estimate in the panel):
  // a config that would burn more credits than the month refills is rejected,
  // not silently accepted and paused mid-month. Checked whenever the burn rate
  // could grow (times / AI images / enabling) — turning things OFF always works.
  if (!isStaff(session.email) && (patch.postingTimes !== undefined || patch.aiImages === true || patch.enabled === true)) {
    const current = await getAutopilotSettings(session.userId)
    const next = { ...current, ...patch }
    if (next.enabled || patch.enabled === true) {
      const profile = await getProfile(session.userId)
      const allowance = planAllowance(profile?.plan ?? 'free')
      const est = estimateMonthlyCredits(next.postingTimes, next.aiImages)
      if (est.creditsPerMonth > allowance) {
        return NextResponse.json(
          {
            error: `This schedule needs about ${fmtCredits(est.creditsPerMonth)} credits a month (${est.postsPerMonth} posts), but your plan refills ${fmtCredits(allowance)}. Remove a time slot${next.aiImages ? ' or switch off AI images' : ''}.`,
            overBudget: true,
          },
          { status: 400 },
        )
      }
    }
  }

  try {
    const settings = await upsertAutopilotSettings(session.userId, patch)
    return NextResponse.json({ settings })
  } catch (err) {
    console.error('[autopilot] update failed:', err)
    return NextResponse.json({ error: 'Could not save autopilot settings.' }, { status: 500 })
  }
}
