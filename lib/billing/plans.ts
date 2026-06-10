// Maps our plan ids to Polar product ids, and tells the draft cap which plans are
// paid (paid plans are uncapped, like staff).

export type PaidPlan = 'pro' | 'starter'

export function isPaidPlanId(value: unknown): value is PaidPlan {
  return value === 'pro' || value === 'starter'
}

/** The Polar product id for a paid plan, or null if it isn't configured. */
export function productIdFor(plan: PaidPlan): string | null {
  if (plan === 'pro') return process.env.POLAR_PRO_PRODUCT_ID || null
  return process.env.POLAR_STARTER_PRODUCT_ID || null
}

/** Reverse lookup: which plan a Polar product id belongs to (for webhooks). */
export function planForProductId(productId: string | undefined | null): PaidPlan | null {
  if (!productId) return null
  if (productId === process.env.POLAR_PRO_PRODUCT_ID) return 'pro'
  if (productId === process.env.POLAR_STARTER_PRODUCT_ID) return 'starter'
  return null
}

/** A user on a paid plan skips the trial draft cap. */
export function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === 'pro' || plan === 'starter'
}
