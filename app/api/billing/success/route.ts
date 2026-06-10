import { NextResponse } from 'next/server'
import { getCheckout } from '@/lib/billing/polar'
import { isPaidPlanId } from '@/lib/billing/plans'
import { setPlan } from '@/lib/profile/store'

// GET /api/billing/success?checkout_id=... — where Polar redirects after payment.
// We confirm the checkout is paid and activate the plan immediately (the webhook
// is the durable backstop). Then bounce the user back into the app.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const checkoutId = url.searchParams.get('checkout_id')
  const home = new URL('/app', req.url)

  if (checkoutId) {
    try {
      const checkout = await getCheckout(checkoutId)
      const userId = checkout?.metadata?.userId
      const plan = checkout?.metadata?.plan
      if (checkout?.paid && typeof userId === 'string' && isPaidPlanId(plan)) {
        await setPlan(userId, plan)
        home.searchParams.set('upgraded', plan)
      }
    } catch (err) {
      console.error('[billing/success] verify failed:', err)
      // Non-fatal: the webhook will activate the plan even if this read failed.
    }
  }
  return NextResponse.redirect(home)
}
