import { COST_PER_AI_PHOTO, COST_PER_AUTO_POST } from '@/lib/creditsConfig'
import type { PostingTime } from '@/lib/schedule/slots'

// Projected monthly credit burn for an autopilot schedule. Pure and shared:
// the settings panel shows it live and the PUT /api/autopilot route enforces
// it against the plan's monthly allowance, so the numbers can never disagree.

export type AutopilotEstimate = {
  /** Auto posts per month this schedule can generate (conservative: rounded up). */
  postsPerMonth: number
  /** Credits those posts will burn, including the AI image on each when enabled. */
  creditsPerMonth: number
  /** Credit price of one auto post under these settings. */
  perPost: number
}

/** A posting time with no `days` runs every day; otherwise on days.length weekdays. */
export function estimateMonthlyCredits(postingTimes: PostingTime[], aiImages: boolean): AutopilotEstimate {
  const slotsPerWeek = postingTimes.reduce((sum, t) => sum + (t.days?.length ?? 7), 0)
  // 30-day month, rounded UP - the cap should overestimate, never undersell.
  const postsPerMonth = Math.ceil((slotsPerWeek * 30) / 7)
  const perPost = COST_PER_AUTO_POST + (aiImages ? COST_PER_AI_PHOTO : 0)
  return { postsPerMonth, creditsPerMonth: postsPerMonth * perPost, perPost }
}
