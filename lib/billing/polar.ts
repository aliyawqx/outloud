// Thin Polar (Merchant of Record) client. Kept tiny + swappable: the rest of the
// app talks to createCheckout / getCheckout / cancelSubscription, never to Polar
// directly. All calls use the org access token (a secret).

const PROD = 'https://api.polar.sh'
const SANDBOX = 'https://sandbox-api.polar.sh'

function apiBase(): string {
  return process.env.POLAR_SERVER === 'sandbox' ? SANDBOX : PROD
}
function token(): string {
  const t = process.env.POLAR_ACCESS_TOKEN
  if (!t) throw new Error('POLAR_ACCESS_TOKEN is not set')
  return t
}
async function polar(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
}

/** Create a hosted checkout session for one product; returns the URL to redirect
 *  the user to. metadata (our userId/plan) flows through to the order/subscription. */
export async function createCheckout(opts: {
  productId: string
  successUrl: string
  customerEmail?: string
  metadata?: Record<string, string>
  /** Pass false to skip the product's trial for this checkout (repeat customers —
   *  Polar allows a trial only once per customer). Defaults to Polar's behavior. */
  allowTrial?: boolean
}): Promise<{ url: string; id: string }> {
  const attempt = (allowTrial: boolean | undefined) =>
    polar('/v1/checkouts/', {
      method: 'POST',
      body: JSON.stringify({
        products: [opts.productId],
        success_url: opts.successUrl,
        ...(opts.customerEmail ? { customer_email: opts.customerEmail } : {}),
        ...(opts.metadata ? { metadata: opts.metadata } : {}),
        ...(allowTrial === false ? { allow_trial: false } : {}),
      }),
    })

  let res = await attempt(opts.allowTrial)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Polar allows a trial only once per customer. If we requested one and the
    // customer already used theirs, retry without the trial (charge now) so a
    // returning customer can still subscribe instead of hitting a dead end.
    const trialUsed = /trial/i.test(body) && /(already used|once per customer|only be used once)/i.test(body)
    if (opts.allowTrial !== false && trialUsed) {
      res = await attempt(false)
    }
    if (!res.ok) {
      const finalBody = res.bodyUsed ? body : await res.text().catch(() => body)
      throw new Error(`Polar checkout create failed: ${res.status} ${finalBody.slice(0, 300)}`)
    }
  }
  const d = (await res.json()) as { id: string; url: string }
  return { url: d.url, id: d.id }
}

export type CheckoutInfo = {
  status: string
  paid: boolean
  metadata: Record<string, unknown>
  customerEmail?: string
  productId?: string
}

/** Read a checkout (used by the success redirect to confirm payment + find the
 *  user from metadata). */
export async function getCheckout(id: string): Promise<CheckoutInfo | null> {
  const res = await polar(`/v1/checkouts/${id}`)
  if (!res.ok) return null
  const d = (await res.json()) as {
    status?: string
    metadata?: Record<string, unknown>
    customer_email?: string
    product_id?: string
  }
  const status = d.status ?? ''
  return {
    status,
    paid: status === 'confirmed' || status === 'succeeded',
    metadata: d.metadata ?? {},
    customerEmail: d.customer_email,
    productId: d.product_id,
  }
}

/** Create a Customer Portal session for a Polar customer and return the portal URL.
 *  The portal lets the customer manage their payment method, view/download invoices,
 *  and change/cancel their subscription — all on Polar. */
export async function createCustomerSession(customerId: string): Promise<{ url: string }> {
  const res = await polar('/v1/customer-sessions', {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Polar customer session failed: ${res.status} ${body.slice(0, 300)}`)
  }
  const d = (await res.json()) as { customer_portal_url?: string }
  if (!d.customer_portal_url) throw new Error('Polar customer session: no portal url in response')
  return { url: d.customer_portal_url }
}

/** Cancel a subscription at period end (used by the in-app "Cancel" button). */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  const res = await polar(`/v1/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ cancel_at_period_end: true }),
  })
  return res.ok
}
