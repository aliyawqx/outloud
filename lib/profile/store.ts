import { ensureSchema, getPool } from '@/lib/db'

export type Incubator = 'yes' | 'no' | null

export type Profile = {
  userId: string
  displayName: string
  handle: string | null
  avatarUrl: string | null
  email: string | null
  plan: string
  /** nFactorial incubator participation: null = not asked yet. */
  incubator: Incubator
  /** Lifetime drafts generated (counts toward the participant cap). */
  draftsUsed: number
  /** Metered-action credit balance (see lib/credits). */
  creditBalance: number
  /** True while a subscription is in its 7-day trial (top-ups are blocked then). */
  trialing: boolean
  /** True once the user has ever started a trial (repeat checkouts skip the trial). */
  trialUsed: boolean
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
  incubator: string | null
  drafts_used: number
  credit_balance: number
  trialing: boolean
  trial_used: boolean
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
    incubator: r.incubator === 'yes' ? 'yes' : r.incubator === 'no' ? 'no' : null,
    draftsUsed: r.drafts_used ?? 0,
    creditBalance: r.credit_balance ?? 0,
    trialing: r.trialing ?? false,
    trialUsed: r.trial_used ?? false,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }
}

/** Record the user's answer to the incubator-participation question. */
export async function setIncubator(userId: string, value: 'yes' | 'no'): Promise<void> {
  await ensureSchema()
  await getPool().query('UPDATE profiles SET incubator = $1, updated_at = now() WHERE user_id = $2', [value, userId])
}

/** Set the user's plan (e.g. after a Polar payment). Paid plans skip the cap. */
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

/** Atomically bump the lifetime draft counter; returns the new total. */
export async function incrementDraftsUsed(userId: string): Promise<number> {
  await ensureSchema()
  const { rows } = await getPool().query<{ drafts_used: number }>(
    'UPDATE profiles SET drafts_used = drafts_used + 1, updated_at = now() WHERE user_id = $1 RETURNING drafts_used',
    [userId],
  )
  return rows[0]?.drafts_used ?? 0
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
