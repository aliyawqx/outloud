// ── Single source of truth for credit costs, allowances & packs ────────────────
// PURE config only (no DB imports) so client components can read it too. The DB
// logic (deduct, grants, usage) lives in lib/credits.ts and re-exports these.

// Action costs — resolved server-side, never trusted from the client. See the
// monetization spec (§1). Searches are ALL-IN: the bundled draft is not charged
// again on top of the search.
export const COST_PER_POST = 1_000
export const COST_PER_REPLY = 5_000
export const COST_PER_TOPIC_SEARCH = 10_000 // scan a topic → draft (all-in)
// Image actions (config only for now; wiring lands with outloud-image-actions-spec).
export const COST_PER_AI_PHOTO = 2_000 // AI-generated image, stacks on a draft
export const COST_PER_PHOTO_SEARCH = 1_000 // photo search for post (licensed stock), stacks on a draft
export const COST_UPLOAD_PHOTO = 0 // user's own file

// Kept as aliases so existing importers don't break.
export const COST_PER_LINK_SEARCH = 5_000 // fetch one link's context → draft (all-in)
export const COST_PER_GOOGLE_PHOTO = COST_PER_PHOTO_SEARCH

/** Credit allowance per plan. On reset the balance is set to this (NOT stacked).
 *  `free` is the size of the card-free TRIAL pool (10k) — granted to every new account
 *  at signup (no card). It is NOT auto-refilled: once spent, or once the trial window
 *  ends, the user must pick a paid plan. */
export const PLAN_ALLOWANCE: Record<string, number> = {
  free: 10_000,
  starter: 200_000, // $15/mo
  pro: 600_000, // $30/mo
}

/** Length of the card-free trial window granted at signup (days). The trial ends on
 *  whichever comes first: the 10k credits run out, or this window elapses. Free accounts
 *  do NOT auto-reset credits; paid plans reset on their Polar billing renewal. */
export const FREE_RESET_DAYS = 3

/** Guaranteed first experience: every user can draft at least this many posts before any
 *  paywall can appear — even at 0 credits / expired window. A hard safety net so no one
 *  hits the card prompt before trying the core feature, regardless of credit accounting. */
export const FREE_DRAFT_FLOOR = 3

/** Deprecated/unused: the starting balance is set directly in createUser as the
 *  card-free trial pool (PLAN_ALLOWANCE.free). Kept at 0 for back-compat. */
export const SIGNUP_GRANT = 0

export function planAllowance(plan: string): number {
  return PLAN_ALLOWANCE[plan] ?? PLAN_ALLOWANCE.free
}

/** Compact credit display used everywhere: 1000→"1k", 600000→"600k", 1500→"1.5k",
 *  250→"250". One source so the sidebar, usage page, packs, and plan cards match. */
export function fmtCredits(n: number): string {
  if (Math.abs(n) < 1000) return String(n)
  const v = n / 1000
  return `${Number.isInteger(v) ? v : Math.round(v * 10) / 10}k`
}

/** Overage credit packs — one-time Polar checkout. `productEnv` names the Polar
 *  product id env var. priceUsd is display-only (Polar holds the real charge).
 *  TODO: confirm final prices. */
export const CREDIT_PACKS = [
  { id: 'pack_100k', label: '100,000 credits', credits: 100_000, priceUsd: 10, bestValue: false, productEnv: 'POLAR_PACK_100K_PRODUCT_ID' },
  { id: 'pack_500k', label: '500,000 credits', credits: 500_000, priceUsd: 40, bestValue: true, productEnv: 'POLAR_PACK_500K_PRODUCT_ID' },
  { id: 'pack_1m', label: '1,000,000 credits', credits: 1_000_000, priceUsd: 70, bestValue: false, productEnv: 'POLAR_PACK_1M_PRODUCT_ID' },
] as const

export type CreditReason =
  | 'grant'
  | 'post'
  | 'reply'
  | 'search' // search by topic
  | 'ai_image'
  | 'photo_search' // photo search for post
  | 'purchase'
  | 'reset'
  | 'refund'

/** Per-feature spend rows for the Usage breakdown. `reason` is the ledger reason a
 *  feature's deduction is logged under; `cost` is its per-action price. Some are not
 *  wired to deduct yet (images) — they simply show 0 until they are. */
export const SPEND_FEATURES: { key: string; label: string; reason: CreditReason; cost: number }[] = [
  { key: 'post', label: 'post', reason: 'post', cost: COST_PER_POST },
  { key: 'photo_search', label: 'photo search for post', reason: 'photo_search', cost: COST_PER_PHOTO_SEARCH },
  { key: 'ai_image', label: 'ai image', reason: 'ai_image', cost: COST_PER_AI_PHOTO },
  { key: 'reply', label: 'reply', reason: 'reply', cost: COST_PER_REPLY },
  { key: 'search', label: 'search by topic', reason: 'search', cost: COST_PER_TOPIC_SEARCH },
]

export function packById(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null
}
/** Reverse lookup for the webhook: which pack a paid Polar product id is. */
export function packByProductId(productId: string | undefined | null) {
  if (!productId) return null
  return CREDIT_PACKS.find((p) => process.env[p.productEnv] === productId) ?? null
}
