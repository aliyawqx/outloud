// Maps our plan ids to Polar product ids, and tells the draft cap which plans are
// paid (paid plans are uncapped, like staff).

export type PaidPlan = 'pro' | 'starter'
export type BillingPeriod = 'monthly' | 'annual'

export function isPaidPlanId(value: unknown): value is PaidPlan {
  return value === 'pro' || value === 'starter'
}

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'monthly' || value === 'annual'
}

/** The Polar product id for a paid plan + billing period, or null if not configured.
 *  Monthly uses the original env vars; annual falls back to monthly when its own
 *  product id isn't set, so checkout never breaks if annual isn't configured yet. */
export function productIdFor(plan: PaidPlan, period: BillingPeriod = 'monthly'): string | null {
  if (plan === 'pro') {
    if (period === 'annual') return process.env.POLAR_PRO_ANNUAL_PRODUCT_ID || process.env.POLAR_PRO_PRODUCT_ID || null
    return process.env.POLAR_PRO_PRODUCT_ID || null
  }
  if (period === 'annual') return process.env.POLAR_STARTER_ANNUAL_PRODUCT_ID || process.env.POLAR_STARTER_PRODUCT_ID || null
  return process.env.POLAR_STARTER_PRODUCT_ID || null
}

/** Reverse lookup: which plan a Polar product id belongs to (for webhooks).
 *  Both monthly and annual products map to the same plan tier. */
export function planForProductId(productId: string | undefined | null): PaidPlan | null {
  if (!productId) return null
  if (productId === process.env.POLAR_PRO_PRODUCT_ID || productId === process.env.POLAR_PRO_ANNUAL_PRODUCT_ID) return 'pro'
  if (productId === process.env.POLAR_STARTER_PRODUCT_ID || productId === process.env.POLAR_STARTER_ANNUAL_PRODUCT_ID) return 'starter'
  return null
}

/** A user on a paid plan skips the trial draft cap. */
export function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === 'pro' || plan === 'starter'
}

/** Billing interval for a Polar product id (billing spec §7 M11). Annual product
 *  ids win; anything else configured is monthly; unknown → null. */
export function intervalForProductId(productId: string | undefined | null): 'monthly' | 'annual' | null {
  if (!productId) return null
  if (productId === process.env.POLAR_PRO_ANNUAL_PRODUCT_ID || productId === process.env.POLAR_STARTER_ANNUAL_PRODUCT_ID)
    return 'annual'
  if (productId === process.env.POLAR_PRO_PRODUCT_ID || productId === process.env.POLAR_STARTER_PRODUCT_ID)
    return 'monthly'
  return null
}
