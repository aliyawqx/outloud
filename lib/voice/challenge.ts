// Build-in-public challenge context, injected by code (the model never computes
// these). Founder-default-client framing: Day N of a 56-day, June 1 2026 start.
// follower_count has no live source yet (no X integration) — set FOLLOWER_COUNT
// in the env to inject it, otherwise it's omitted.

const START_MS = Date.UTC(2026, 5, 1) // June 1, 2026 (month is 0-indexed)

/** 1-based day number since the June 1 start. */
export function challengeDay(nowMs = Date.now()): number {
  return Math.floor((nowMs - START_MS) / 86_400_000) + 1
}

/** Current follower count from the env, or undefined if not configured. */
export function followerCount(): number | undefined {
  const v = process.env.FOLLOWER_COUNT
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
