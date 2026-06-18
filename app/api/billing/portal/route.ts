import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { createCustomerSession } from '@/lib/billing/polar'

// POST /api/billing/portal — open the Polar customer portal (payment method,
// invoices, change/cancel subscription). Needs a stored Polar customer id, which
// the billing webhook records on first checkout.
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const profile = await getProfile(session.userId)
  if (!profile?.polarCustomerId) {
    return NextResponse.json({ error: 'No billing account yet — start a plan first.', noCustomer: true }, { status: 409 })
  }

  try {
    const { url } = await createCustomerSession(profile.polarCustomerId)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[billing/portal] failed:', err)
    return NextResponse.json({ error: "Couldn't open the billing portal. Try again." }, { status: 502 })
  }
}
