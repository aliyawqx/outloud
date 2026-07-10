import { isStaff } from '@/lib/appLock'
import { getProfile } from '@/lib/profile/store'

// THE tier source of truth (plan-gating spec §3): every gate — autopilot
// enable, the generation cron's defensive re-check, and manual-post gating —
// asks here.

const PRO_PLANS = new Set(['pro', 'founder'])
const PAID_PLANS = new Set(['starter', 'pro', 'founder'])

/** Card-free 3-day trial still running. Same semantics as the layout's trial
 *  window: it ends when ALL credits hit 0 OR the window elapses OR a Polar sub
 *  takes over. Purchased top-up credits COUNT: trial users may buy packs, and
 *  those credits must stay spendable for the rest of the window (deduct spends
 *  the plan bucket first, then topup). Pure so the layout and getUserTier share it. */
export function isTrialActive(
  p: {
    trialing?: boolean | null
    polarSubscriptionId?: string | null
    creditBalance?: number | null
    topupBalance?: number | null
    creditsResetAt?: string | Date | null
  } | null,
): boolean {
  return Boolean(
    p?.trialing &&
      !p.polarSubscriptionId &&
      (p.creditBalance ?? 0) + (p.topupBalance ?? 0) > 0 &&
      p.creditsResetAt &&
      new Date(p.creditsResetAt).getTime() > Date.now(),
  )
}

export type TierInfo = {
  plan: string
  /** Billing lifecycle: 'trialing'|'active'|'past_due'|'canceled'|'expired'. */
  planStatus: string
  trialActive: boolean
  /** Legacy pro-ish check (plan or trial). Prefer canUseAutopilot for gating. */
  isPro: boolean
  /** Manual generation access: any paid plan, staff, or an active trial. */
  hasActivePlan: boolean
  /** THE autopilot gate (billing spec §6): Pro/founder plan whose status is
   *  usable. 'canceled' still counts — access runs until period end (M6);
   *  the lazy expiry flips it to 'expired'. Trial does NOT get autopilot (§3). */
  canUseAutopilot: boolean
}

const USABLE_STATUSES = new Set(['active', 'canceled', 'trialing'])

export async function getUserTier(userId: string, email?: string): Promise<TierInfo> {
  const profile = await getProfile(userId)
  const plan = profile?.plan ?? 'free'
  const planStatus = profile?.planStatus ?? 'trialing'
  const trialActive = isTrialActive(profile)
  const staff = email ? isStaff(email) : false
  return {
    plan,
    planStatus,
    trialActive,
    isPro: staff || PRO_PLANS.has(plan) || trialActive,
    hasActivePlan: staff || PAID_PLANS.has(plan) || trialActive,
    // 'trialing' in USABLE covers a PAID Polar trial on the Pro product (has a
    // subscription); the card-free signup trial has plan='free' and never passes
    // the PRO_PLANS check, so §3's "trial has no autopilot" holds.
    canUseAutopilot: staff || (PRO_PLANS.has(plan) && USABLE_STATUSES.has(planStatus)),
  }
}
