import { NextResponse } from 'next/server'
import { getCheckout } from '@/lib/billing/polar'
import { isPaidPlanId } from '@/lib/billing/plans'
import { setPlan, setTrialing, markTrialStarted, setPolarRefs } from '@/lib/profile/store'
import { grantPlan, grantTrialPool } from '@/lib/credits'

// GET /api/billing/success?checkout_id=... — where Polar redirects after checkout.
// We activate immediately (plan + credits) so it works even before the webhook lands
// (and locally, where Polar can't reach the webhook). The webhook is the durable
// backstop; all the grants are idempotent (flat sets), so double-processing is safe.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const checkoutId = url.searchParams.get('checkout_id')
  const home = new URL('/app', req.url)

  if (checkoutId) {
    try {
      const checkout = await getCheckout(checkoutId)
      const userId = checkout?.metadata?.userId
      const plan = checkout?.metadata?.plan
      if (checkout?.completed && typeof userId === 'string' && isPaidPlanId(plan)) {
        await setPlan(userId, plan)
        await setPolarRefs(userId, { customerId: checkout.customerId, subscriptionId: checkout.subscriptionId })
        if (checkout.amount > 0) {
          // Real charge (trial converted/skipped or direct subscribe) → full allowance.
          await setTrialing(userId, false)
          await grantPlan(userId, plan)
        } else {
          // No charge → 7-day trial started: 10k pool + trial flags.
          await markTrialStarted(userId)
          await grantTrialPool(userId)
        }
        home.searchParams.set('upgraded', plan)
      }
    } catch (err) {
      console.error('[billing/success] verify failed:', err)
      // Non-fatal: the webhook will activate even if this read failed.
    }
  }
  return NextResponse.redirect(home)
}
