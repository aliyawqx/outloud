import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { planForProductId } from '@/lib/billing/plans'
import { setPlan, setTrialing } from '@/lib/profile/store'
import { getUserByEmail } from '@/lib/auth/users'
import { addCredits, grantPlan, grantTrialPool, packByProductId } from '@/lib/credits'

// POST /api/billing/webhook — Polar's durable activation path (Standard Webhooks).
// Verifies the signature, then flips the user's plan on subscribe / cancel. Set
// POLAR_WEBHOOK_SECRET (Polar -> Settings -> Webhooks) to enable it.

function verify(secret: string, id: string | null, ts: string | null, body: string, sigHeader: string | null): boolean {
  if (!id || !ts || !sigHeader) return false
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
  const exp = Buffer.from(expected)
  // The header is space-separated "v1,<sig>" entries.
  return sigHeader.split(' ').some((part) => {
    const sig = part.includes(',') ? part.split(',')[1] : part
    const buf = Buffer.from(sig)
    return buf.length === exp.length && crypto.timingSafeEqual(buf, exp)
  })
}

/** Find the user a Polar event belongs to: metadata.userId first, else email. */
async function resolveUserId(data: Record<string, unknown>): Promise<string | null> {
  const meta = (data.metadata ?? {}) as Record<string, unknown>
  if (typeof meta.userId === 'string') return meta.userId
  const customer = (data.customer ?? {}) as { email?: string }
  const email = customer.email ?? (data.customer_email as string | undefined)
  if (email) return (await getUserByEmail(email))?.id ?? null
  return null
}

export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  const raw = await req.text()
  if (!secret) {
    console.warn('[billing/webhook] POLAR_WEBHOOK_SECRET not set — ignoring event')
    return NextResponse.json({ ok: true })
  }
  if (!verify(secret, req.headers.get('webhook-id'), req.headers.get('webhook-timestamp'), raw, req.headers.get('webhook-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { type?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const type = event.type ?? ''
  const data = event.data ?? {}

  try {
    const productId = data.product_id as string | undefined
    const status = typeof data.status === 'string' ? data.status : undefined
    const pack = packByProductId(productId)

    if (type === 'order.paid' && pack) {
      // One-time credit-pack purchase → add credits, no plan change.
      const userId = await resolveUserId(data)
      if (userId) await addCredits(userId, pack.credits, { pack: pack.id, productId, orderId: data.id })
    } else if (type === 'order.paid') {
      // A real charge: trial conversion (day 7) OR a renewal → reset to the full plan
      // allowance. Trial-start does NOT fire order.paid, so the 10k trial pool is only
      // replaced here, at the first actual payment. order.paid also fires each renewal.
      const userId = await resolveUserId(data)
      const plan = planForProductId(productId)
      if (userId && plan) {
        await setPlan(userId, plan)
        await setTrialing(userId, false) // a real charge means the trial converted
        await grantPlan(userId, plan) // reset (not stack) to the plan's allowance
      }
    } else if (type === 'subscription.created' && status === 'trialing') {
      // Trial start (card added, no charge): set the plan label so the gate is passed,
      // grant the 10k trial pool (NOT the full plan), and flag the trial (no top-ups).
      const userId = await resolveUserId(data)
      const plan = planForProductId(productId)
      if (userId && plan) {
        await setPlan(userId, plan)
        await setTrialing(userId, true)
        await grantTrialPool(userId)
      }
    } else if (type === 'subscription.active' || type === 'subscription.created' || type === 'subscription.uncanceled') {
      // Other subscription state changes: keep the plan label in sync. Credits are
      // granted by order.paid (renewal/conversion) — never re-granted here, so a mid-
      // trial update can't refill spent credits.
      const userId = await resolveUserId(data)
      const plan = planForProductId(productId)
      if (userId && plan) await setPlan(userId, plan)
    } else if (type === 'subscription.revoked') {
      const userId = await resolveUserId(data)
      if (userId) {
        await setPlan(userId, 'free')
        await setTrialing(userId, false)
      }
    }
  } catch (err) {
    console.error('[billing/webhook] handler failed:', err)
    return NextResponse.json({ error: 'handler error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
