import { ensureSchema, getPool } from '@/lib/db'

export type Profile = {
  userId: string
  displayName: string
  handle: string | null
  avatarUrl: string | null
  email: string | null
  plan: string
  /** Plan-allowance credit balance this cycle (resets each cycle). */
  creditBalance: number
  /** Persistent purchased top-up credits (never expire/reset). */
  topupBalance: number
  /** True while a subscription is in its 7-day trial (top-ups are blocked then). */
  trialing: boolean
  /** True once the user has ever started a trial (repeat checkouts skip the trial). */
  trialUsed: boolean
  /** Polar customer id — powers the customer-portal link. Null until first checkout. */
  polarCustomerId: string | null
  polarSubscriptionId: string | null
  createdAt: string
  updatedAt: string
}

type Row = {
  user_id: string
  display_name: string
  handle: string | null
  avatar_url: string | null
  email: string | null
  plan: string
  credit_balance: number
  topup_balance: number
  trialing: boolean
  trial_used: boolean
  polar_customer_id: string | null
  polar_subscription_id: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(r: Row): Profile {
  return {
    userId: r.user_id,
    displayName: r.display_name,
    handle: r.handle,
    avatarUrl: r.avatar_url,
    email: r.email,
    plan: r.plan,
    creditBalance: r.credit_balance ?? 0,
    topupBalance: r.topup_balance ?? 0,
    trialing: r.trialing ?? false,
    trialUsed: r.trial_used ?? false,
    polarCustomerId: r.polar_customer_id ?? null,
    polarSubscriptionId: r.polar_subscription_id ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }
}

/** Set the user's plan (e.g. after a Polar payment). */
export async function setPlan(userId: string, plan: string): Promise<void> {
  await ensureSchema()
  await getPool().query('UPDATE profiles SET plan = $1, updated_at = now() WHERE user_id = $2', [plan, userId])
}

/** Flag whether the subscription is currently in its trial (blocks top-ups). */
export async function setTrialing(userId: string, value: boolean): Promise<void> {
  await ensureSchema()
  await getPool().query('UPDATE profiles SET trialing = $1, updated_at = now() WHERE user_id = $2', [value, userId])
}

/** Mark the trial as started: in-trial now AND used-ever (the latter never resets,
 *  so future checkouts skip the trial). */
export async function markTrialStarted(userId: string): Promise<void> {
  await ensureSchema()
  await getPool().query('UPDATE profiles SET trialing = true, trial_used = true, updated_at = now() WHERE user_id = $1', [userId])
}

/** Store Polar references from the billing webhook. When `periodEnd` is given it also
 *  becomes the exact reset date (overriding the ~30d approximation). Each field is
 *  only written when provided, so partial events don't wipe existing values. */
export async function setPolarRefs(
  userId: string,
  refs: { customerId?: string | null; subscriptionId?: string | null; periodEnd?: Date | null },
): Promise<void> {
  await ensureSchema()
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  if (refs.customerId !== undefined) { sets.push(`polar_customer_id = $${i++}`); vals.push(refs.customerId) }
  if (refs.subscriptionId !== undefined) { sets.push(`polar_subscription_id = $${i++}`); vals.push(refs.subscriptionId) }
  if (refs.periodEnd) { sets.push(`credits_reset_at = $${i++}`); vals.push(refs.periodEnd) }
  if (sets.length === 0) return
  sets.push('updated_at = now()')
  vals.push(userId)
  await getPool().query(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = $${i}`, vals)
}

export async function getProfile(userId: string): Promise<Profile | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>('SELECT * FROM profiles WHERE user_id = $1', [userId])
  return rows[0] ? mapRow(rows[0]) : null
}

export type ProfilePatch = {
  displayName?: string
  handle?: string | null
  avatarUrl?: string | null
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<Profile | null> {
  await ensureSchema()
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  if (patch.displayName !== undefined) {
    sets.push(`display_name = $${i++}`)
    vals.push(patch.displayName)
  }
  if (patch.handle !== undefined) {
    sets.push(`handle = $${i++}`)
    vals.push(patch.handle)
  }
  if (patch.avatarUrl !== undefined) {
    sets.push(`avatar_url = $${i++}`)
    vals.push(patch.avatarUrl)
  }
  if (sets.length === 0) return getProfile(userId)

  sets.push('updated_at = now()')
  vals.push(userId)
  const { rows } = await getPool().query<Row>(
    `UPDATE profiles SET ${sets.join(', ')} WHERE user_id = $${i} RETURNING *`,
    vals,
  )
  return rows[0] ? mapRow(rows[0]) : null
}
