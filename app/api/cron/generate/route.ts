import { NextResponse } from 'next/server'
import { fillSlot } from '@/lib/autopilot/generate'
import { dropAutopilotForNonPro } from '@/lib/autopilot/gating'
import { getUserTier } from '@/lib/billing/tier'
import { listAutopilotCandidates } from '@/lib/autopilot/store'
import { ModelBusyError } from '@/lib/anthropic'
import { isCronAuthorized } from '@/lib/cron/auth'
import { upcomingSlots } from '@/lib/schedule/slots'

// Generation cron (spec §6a): for each autopilot user, fill upcoming empty
// slots inside their lead-time window. Triggered externally every ~15 min.
// LLM calls are slow (~10-30s), so each run is budgeted: leftover slots are
// picked up by the next run — lead_time (240 min) >> trigger interval.
export const maxDuration = 60

const MAX_GENERATIONS_PER_RUN = 3
const TIME_BUDGET_MS = 45_000

async function run(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const started = Date.now()
  const now = new Date()
  const candidates = await listAutopilotCandidates()
  let generated = 0
  let occupied = 0
  let skipped = 0
  let paused = 0

  outer: for (const { settings, email } of candidates) {
    if (generated >= MAX_GENERATIONS_PER_RUN || Date.now() - started > TIME_BUDGET_MS) break
    // Defensive tier re-check (plan-gating spec §3.2): a downgraded user may
    // still carry a stale enabled=true row — never auto-post for them; clean up.
    const tier = await getUserTier(settings.userId, email)
    if (!tier.isPro) {
      await dropAutopilotForNonPro(settings.userId).catch((e) =>
        console.error('[cron/generate] downgrade cleanup failed:', e),
      )
      skipped++
      continue
    }
    if (!settings.interests.length || !settings.postingTimes.length || !settings.platforms.length) {
      skipped++
      continue
    }
    const slots = upcomingSlots(
      { postingTimes: settings.postingTimes, timezone: settings.timezone, slotsPerDay: settings.slotsPerDay },
      now,
      settings.leadTimeMinutes,
    )
    for (const slot of slots) {
      if (generated >= MAX_GENERATIONS_PER_RUN || Date.now() - started > TIME_BUDGET_MS) break outer
      try {
        const result = await fillSlot({ userId: settings.userId, email }, settings, slot)
        if (result === 'generated') generated++
        else if (result === 'occupied') occupied++
        else if (result === 'paused_credits') {
          paused++
          break // stop for this user (spec §6a.3)
        } else skipped++
      } catch (err) {
        if (err instanceof ModelBusyError) {
          console.warn('[cron/generate] model busy — ending run early')
          break outer
        }
        throw err
      }
    }
  }

  return NextResponse.json({ users: candidates.length, generated, occupied, skipped, paused })
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
