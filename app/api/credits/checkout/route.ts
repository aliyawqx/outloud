import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createCheckout } from '@/lib/billing/polar'
import { packById } from '@/lib/credits'
import { getProfile } from '@/lib/profile/store'
import { isPaidPlan } from '@/lib/billing/plans'

// POST /api/credits/checkout — start a Polar checkout for a one-time credit pack.
// The webhook (order.paid → addCredits) is the durable path that actually credits
// the balance; this just opens the hosted checkout tied to the user.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in to buy credits.', needsAuth: true }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const packId = (body as { pack?: unknown }).pack
  const pack = typeof packId === 'string' ? packById(packId) : null
  if (!pack) return NextResponse.json({ error: 'Unknown credit pack.' }, { status: 400 })

  // Top-ups are only for users on an active PAID plan — not free users and not
  // during the free trial. The path forward for them is to start/convert a plan.
  const profile = await getProfile(session.userId)
  if (!isPaidPlan(profile?.plan) || profile?.trialing) {
    const error = profile?.trialing
      ? "Top-ups unlock once your plan starts, after your free trial."
      : 'Top-ups are available on a paid plan. Upgrade to add credits.'
    return NextResponse.json({ error, ineligible: true }, { status: 409 })
  }

  const productId = process.env[pack.productEnv]
  if (!productId) {
    console.error('[credits/checkout] product id not configured for', pack.id)
    return NextResponse.json({ error: 'Credit packs are not available yet.' }, { status: 503 })
  }

  const origin = new URL(req.url).origin
  // Route through the success handler so the top-up is credited immediately (and
  // locally, where the webhook can't reach). Idempotent, so the webhook won't double it.
  const successUrl = `${origin}/api/billing/success?checkout_id={CHECKOUT_ID}`
  try {
    const { url } = await createCheckout({
      productId,
      successUrl,
      customerEmail: session.email,
      metadata: { userId: session.userId, pack: pack.id },
    })
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[credits/checkout] failed:', err)
    return NextResponse.json({ error: "Couldn't start checkout. Try again." }, { status: 502 })
  }
}
