import { ensureSchema, getPool } from '@/lib/db'

export type Profile = {
  userId: string
  displayName: string
  handle: string | null
  avatarUrl: string | null
  email: string | null
  plan: string
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
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }
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
