import { NextResponse } from 'next/server'
import { getCheckout } from '@/lib/billing/polar'
import { isPaidPlanId } from '@/lib/billing/plans'
import { setPlan, setPlanStatus, setTrialing, markTrialStarted, setPolarRefs } from '@/lib/profile/store'
import { grantPlan, addCredits, packById } from '@/lib/credits'

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
      const packId = typeof checkout?.metadata?.pack === 'string' ? checkout.metadata.pack : undefined
      const pack = packId ? packById(packId) : null

      // One-time credit-pack top-up → add to the persistent bucket (idempotent by
      // checkout id, so the webhook won't double it). Land back on the usage page.
      if (checkout?.completed && typeof userId === 'string' && pack) {
        await addCredits(userId, pack.credits, { idempotencyKey: checkoutId, metadata: { pack: pack.id } })
        return NextResponse.redirect(new URL('/app/settings/billing?topup=success', req.url))
      }

      if (checkout?.completed && typeof userId === 'string' && isPaidPlanId(plan)) {
        await setPlan(userId, plan)
        await setPolarRefs(userId, { customerId: checkout.customerId, subscriptionId: checkout.subscriptionId })
        if (checkout.amount > 0) {
          // Real charge (trial converted/skipped or direct subscribe) → full allowance.
          // plan_status must flip too: a stale 'expired' (from a lapsed trial) fails
          // the canUseAutopilot status check and locks Max features on a freshly
          // paid account whenever the webhook is late or lost.
          await setTrialing(userId, false)
          await setPlanStatus(userId, 'active')
          await grantPlan(userId, plan)
        } else {
          // No charge → a Polar trial started. Subscribers get the FULL plan allowance
          // up front (not the 10k pool); the trial flags still block top-ups + mark it used.
          await markTrialStarted(userId)
          await setPlanStatus(userId, 'trialing')
          await grantPlan(userId, plan)
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
