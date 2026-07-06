// Pure, DST-safe slot math. NO date library in this repo — everything is native
// Date + Intl. All returned instants are UTC Dates; wall-clock inputs carry an
// IANA timezone. Keep this file free of DB/IO so it stays unit-testable.

/** Manual-vs-autopilot slot match window (minutes). Used by BOTH the generation
 *  cron's occupancy check and the manual-schedule conflict rule (spec §7). */
export const SLOT_WINDOW_MINUTES = 30

export type PostingTime = { time: string; days?: number[] } // days: 0=Sunday..6; absent = every day
export type SlotConfig = { postingTimes: PostingTime[]; timezone: string; slotsPerDay: number }

/** Offset of `tz` from UTC at the instant `utc`, in ms (negative west of UTC). */
function tzOffsetMs(tz: string, utc: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
      .formatToParts(utc)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    parts.hour === '24' ? 0 : +parts.hour, +parts.minute, +parts.second,
  )
  return asUtc - utc.getTime()
}

/**
 * Wall-clock time in `tz` → UTC instant, DST-safe. `m` is 1-based. The second
 * offset lookup handles transitions: a nonexistent spring-forward time maps to
 * a stable nearby instant; an ambiguous fall-back time takes its first occurrence.
 */
export function zonedTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const naive = Date.UTC(y, m - 1, d, hh, mm)
  const first = tzOffsetMs(tz, new Date(naive))
  const offset = tzOffsetMs(tz, new Date(naive - first))
  return new Date(naive - offset)
}

/** The calendar date (y, m 1-based, d) that `utc` falls on in `tz`. */
export function dateInTz(utc: Date, tz: string): { y: number; m: number; d: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(utc)
      .map((p) => [p.type, p.value]),
  )
  return { y: +parts.year, m: +parts.month, d: +parts.day }
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const TIME_RE = /^(\d{2}):(\d{2})$/

/** The day's quota slots (sorted, capped) for the calendar date y-m-d in cfg's zone. */
function quotaSlotsForDay(cfg: SlotConfig, y: number, m: number, d: number, weekday: number): Date[] {
  const daySlots: Date[] = []
  for (const pt of cfg.postingTimes) {
    const match = TIME_RE.exec(pt.time ?? '')
    if (!match) continue
    const hh = +match[1]
    const mm = +match[2]
    if (hh > 23 || mm > 59) continue
    if (pt.days && pt.days.length > 0 && !pt.days.includes(weekday)) continue
    daySlots.push(zonedTimeToUtc(y, m, d, hh, mm, cfg.timezone))
  }
  daySlots.sort((a, b) => a.getTime() - b.getTime())
  const quota = Number.isFinite(cfg.slotsPerDay) ? Math.max(1, cfg.slotsPerDay) : 1
  return daySlots.slice(0, quota)
}

/**
 * All slot instants in (now, now + horizonMinutes], honoring the per-day quota.
 * The quota is applied to the day's FULL slot list before dropping past times,
 * so a passed morning slot doesn't promote an evening time into the quota.
 */
export function upcomingSlots(cfg: SlotConfig, now: Date, horizonMinutes: number): Date[] {
  const end = now.getTime() + horizonMinutes * 60_000
  const out: Date[] = []
  const start = dateInTz(now, cfg.timezone)
  const days = Math.ceil(horizonMinutes / 1440) + 1
  for (let i = 0; i <= days; i++) {
    // Day arithmetic on the tz-local calendar date, via a UTC-noon anchor.
    const anchor = new Date(Date.UTC(start.y, start.m - 1, start.d + i))
    const y = anchor.getUTCFullYear()
    const m = anchor.getUTCMonth() + 1
    const d = anchor.getUTCDate()
    const weekday = anchor.getUTCDay() // weekday of a calendar date is tz-independent
    for (const t of quotaSlotsForDay(cfg, y, m, d, weekday)) {
      if (t.getTime() > now.getTime() && t.getTime() <= end) out.push(t)
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime())
}

/**
 * 0-based rank of `slot` among its local day's quota slots — stable regardless
 * of when generation runs, so topic rotation across slots stays deterministic
 * (zero-touch addendum A.3). Unmatched instants rank 0.
 */
export function slotRankInDay(cfg: SlotConfig, slot: Date): number {
  const { y, m, d } = dateInTz(slot, cfg.timezone)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const idx = quotaSlotsForDay(cfg, y, m, d, weekday).findIndex((t) => t.getTime() === slot.getTime())
  return Math.max(0, idx)
}
