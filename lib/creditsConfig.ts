// ── Single source of truth for credit costs, allowances & packs ────────────────
// PURE config only (no DB imports) so client components can read it too. The DB
// logic (deduct, grants, usage) lives in lib/credits.ts and re-exports these.

// Action costs — resolved server-side, never trusted from the client. See the
// monetization spec (§1). Searches are ALL-IN: the bundled draft is not charged
// again on top of the search.
export const COST_PER_POST = 1_000
export const COST_PER_REPLY = 1_000
export const COST_PER_LINK_SEARCH = 5_000 // fetch one link's context → draft (all-in)
export const COST_PER_TOPIC_SEARCH = 10_000 // scan a topic → draft (all-in)
// Image actions (config only for now; wiring lands with outloud-image-actions-spec).
export const COST_PER_AI_PHOTO = 2_000 // stacks on a draft
export const COST_PER_GOOGLE_PHOTO = 1_000 // licensed stock image, stacks on a draft
export const COST_UPLOAD_PHOTO = 0 // user's own file

/** Credit allowance per plan. On reset the balance is set to this (NOT stacked).
 *  `free` is the 7-day trial pool (10k); proper trial mechanics are a later phase. */
export const PLAN_ALLOWANCE: Record<string, number> = {
  free: 10_000,
  starter: 200_000, // $15/mo
  pro: 600_000, // $30/mo
}

/** Free credits auto-reset on this cadence (lazy, on read). Paid plans reset on
 *  their Polar billing renewal instead. */
export const FREE_RESET_DAYS = 7

/** Credits a brand-new account starts with (the free allowance). */
export const SIGNUP_GRANT = PLAN_ALLOWANCE.free

export function planAllowance(plan: string): number {
  return PLAN_ALLOWANCE[plan] ?? PLAN_ALLOWANCE.free
}

/** Overage credit packs — one-time Polar checkout. `productEnv` names the Polar
 *  product id env var. priceUsd is display-only (Polar holds the real charge).
 *  TODO: confirm final prices. */
export const CREDIT_PACKS = [
  { id: 'pack_100k', label: '100,000 credits', credits: 100_000, priceUsd: 10, bestValue: false, productEnv: 'POLAR_PACK_100K_PRODUCT_ID' },
  { id: 'pack_500k', label: '500,000 credits', credits: 500_000, priceUsd: 40, bestValue: true, productEnv: 'POLAR_PACK_500K_PRODUCT_ID' },
  { id: 'pack_1m', label: '1,000,000 credits', credits: 1_000_000, priceUsd: 70, bestValue: false, productEnv: 'POLAR_PACK_1M_PRODUCT_ID' },
] as const

export type CreditReason = 'grant' | 'post' | 'reply' | 'search' | 'purchase' | 'reset'

export function packById(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null
}
/** Reverse lookup for the webhook: which pack a paid Polar product id is. */
export function packByProductId(productId: string | undefined | null) {
  if (!productId) return null
  return CREDIT_PACKS.find((p) => process.env[p.productEnv] === productId) ?? null
}
