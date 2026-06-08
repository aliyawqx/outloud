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
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }
}

/** Record the user's answer to the incubator-participation question. */
export async function setIncubator(userId: string, value: 'yes' | 'no'): Promise<void> {
  await ensureSchema()
  await getPool().query('UPDATE profiles SET incubator = $1, updated_at = now() WHERE user_id = $2', [value, userId])
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
