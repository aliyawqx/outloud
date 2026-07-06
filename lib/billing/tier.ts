import { isStaff } from '@/lib/appLock'
import { getProfile } from '@/lib/profile/store'

// THE tier source of truth (plan-gating spec §3): every gate — autopilot
// enable, the generation cron's defensive re-check, and manual-post gating —
// asks here.

const PRO_PLANS = new Set(['pro', 'founder'])
const PAID_PLANS = new Set(['starter', 'pro', 'founder'])

/** Card-free 3-day trial still running. Same semantics as the layout's trial
 *  window: it ends when credits hit 0 OR the window elapses OR a Polar sub
 *  takes over. Pure so both the layout and getUserTier share it. */
export function isTrialActive(
  p: {
    trialing?: boolean | null
    polarSubscriptionId?: string | null
    creditBalance?: number | null
    creditsResetAt?: string | Date | null
  } | null,
): boolean {
  return Boolean(
    p?.trialing &&
      !p.polarSubscriptionId &&
      (p.creditBalance ?? 0) > 0 &&
      p.creditsResetAt &&
      new Date(p.creditsResetAt).getTime() > Date.now(),
  )
}

export type TierInfo = {
  plan: string
  trialActive: boolean
  /** Autopilot access: Pro/founder plan, staff, or an active trial (spec §5). */
  isPro: boolean
  /** Manual generation access: any paid plan, staff, or an active trial. */
  hasActivePlan: boolean
}

export async function getUserTier(userId: string, email?: string): Promise<TierInfo> {
  const profile = await getProfile(userId)
  const plan = profile?.plan ?? 'free'
  const trialActive = isTrialActive(profile)
  const staff = email ? isStaff(email) : false
  return {
    plan,
    trialActive,
    isPro: staff || PRO_PLANS.has(plan) || trialActive,
    hasActivePlan: staff || PAID_PLANS.has(plan) || trialActive,
  }
}
