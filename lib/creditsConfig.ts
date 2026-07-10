// ── Single source of truth for credit costs, allowances & packs ────────────────
// PURE config only (no DB imports) so client components can read it too. The DB
// logic (deduct, grants, usage) lives in lib/credits.ts and re-exports these.

// Action costs — resolved server-side, never trusted from the client. See the
// monetization spec (§1). Searches are ALL-IN: the bundled draft is not charged
// again on top of the search.
export const COST_PER_POST = 1_000
// Canonical billing spec §4: the balance check runs before EVERY generate —
// manual posts are back on the credit meter (the previous unlimited lever is
// revoked). Flip to true to decouple manual posts from credits again.
export const MANUAL_POSTS_UNLIMITED = false

// An autopilot-generated post costs the same as a manually generated one. ONE
// config constant so pricing changes in a single place (monetization spec §12).
export const COST_PER_AUTO_POST = COST_PER_POST
// Warn before autopilot runs dry (zero-touch addendum A.4): fire a low-credit
// notification when fewer than this many auto posts remain affordable.
export const LOW_CREDIT_POSTS_LEFT = 5
export const COST_PER_REPLY = 3_000 // canonical billing spec §2 (was 5k)
/** Canonical cost table (billing spec §2). The individual constants remain the
 *  implementation; this object is the spec-facing name. */
export const CREDIT_COSTS = { post: COST_PER_POST, reply: COST_PER_REPLY } as const
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
  founder: 1_000_000_000, // comp / staff — effectively unlimited
}

/** Length of the card-free trial window granted at signup (days). The trial ends on
 *  whichever comes first: the 10k credits run out, or this window elapses. Free accounts
 *  do NOT auto-reset credits; paid plans reset on their Polar billing renewal. */
export const FREE_RESET_DAYS = 3

/** Billing spec M2: expiry locks ALL generation — the 10k trial is the
 *  guaranteed first experience, so the old 3-draft floor is disabled. */
export const FREE_DRAFT_FLOOR = 0

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
 *  product id env var. priceUsd is display-only (Polar holds the real charge). */
// priceUsd is DISPLAY ONLY — the real charge is the Polar product's price. Keep these
// in sync with Polar ($12 / $45 / $80): update the Polar products BEFORE deploying a
// price change here. The bestValue pack ($45 / 500k) is the default-selected "main"
// top-up shown first in the top-up card.
//
// Pricing rule: every pack's per-credit rate stays ABOVE every plan's rate
// (Starter $15/200k = $0.075 per 1k, Pro $39/600k = $0.065 per 1k), so a big
// top-up never becomes a cheaper substitute for subscribing. Bigger packs still
// get a better rate ($0.12 → $0.09 → $0.08 per 1k), but the 1M pack remains
// worse value than any plan — top-ups complement subscriptions, never replace them.
// anchorUsd is the crossed-out "was" price shown next to priceUsd (Higgsfield-style
// anchor). Display-only, like priceUsd.
export const CREDIT_PACKS = [
  { id: 'pack_100k', label: '100,000 credits', credits: 100_000, priceUsd: 12, anchorUsd: 15, bestValue: false, productEnv: 'POLAR_PACK_100K_PRODUCT_ID' },
  { id: 'pack_500k', label: '500,000 credits', credits: 500_000, priceUsd: 45, anchorUsd: 60, bestValue: true, productEnv: 'POLAR_PACK_500K_PRODUCT_ID' },
  { id: 'pack_1m', label: '1,000,000 credits', credits: 1_000_000, priceUsd: 80, anchorUsd: 110, bestValue: false, productEnv: 'POLAR_PACK_1M_PRODUCT_ID' },
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
