import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createCheckout } from '@/lib/billing/polar'
import { isBillingPeriod, isPaidPlanId, productIdFor } from '@/lib/billing/plans'
import { getProfile } from '@/lib/profile/store'

// POST /api/billing/checkout — start a Polar checkout for a paid plan. Ties the
// payment to the signed-in user via metadata so the webhook/success can activate
// the right account. Returns the hosted checkout URL for the client to open.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in to subscribe.', needsAuth: true }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const plan = (body as { plan?: unknown }).plan
  if (!isPaidPlanId(plan)) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 })

  const rawPeriod = (body as { period?: unknown }).period
  const period = isBillingPeriod(rawPeriod) ? rawPeriod : 'monthly'

  const productId = productIdFor(plan, period)
  if (!productId) {
    console.error('[billing/checkout] product id not configured for', plan)
    return NextResponse.json({ error: 'Checkout is not available yet.' }, { status: 503 })
  }

  const origin = new URL(req.url).origin
  const successUrl = `${origin}/api/billing/success?checkout_id={CHECKOUT_ID}`

  // A customer can only trial once — repeat checkouts skip the trial and charge now.
  // skipTrial lets the user explicitly start their subscription immediately (e.g. the
  // "Start a subscription" button on Billing), bypassing any remaining free trial.
  const skipTrial = (body as { skipTrial?: unknown }).skipTrial === true
  const profile = await getProfile(session.userId)
  const allowTrial = !profile?.trialUsed && !skipTrial

  try {
    const { url } = await createCheckout({
      productId,
      successUrl,
      customerEmail: session.email,
      metadata: { userId: session.userId, plan, period },
      allowTrial,
    })
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[billing/checkout] failed:', err)
    return NextResponse.json({ error: "Couldn't start checkout. Try again." }, { status: 502 })
  }
}
