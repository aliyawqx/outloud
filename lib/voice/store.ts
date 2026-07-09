import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import type { Channel, ProfileKind, SourceRef, VoiceProfile } from './types'

// Persistence for voice profiles. Every query is scoped to an owner_key so one
// owner can never read or mutate another's rows. Phase 1 owner_key is an
// anonymous client id; swap the source of that key when real auth lands.

type Row = {
  id: string
  owner_key: string
  kind: string
  name: string
  sources: SourceRef[]
  merged_tags: string[]
  style_summary: string
  style_guide: string | null
  channel: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

function mapRow(r: Row): VoiceProfile {
  return {
    id: r.id,
    ownerKey: r.owner_key,
    kind: r.kind as ProfileKind,
    name: r.name,
    sources: r.sources ?? [],
    mergedTags: r.merged_tags ?? [],
    styleSummary: r.style_summary,
    styleGuide: r.style_guide ?? '',
    channel: (r.channel as Channel) ?? 'x',
    isActive: r.is_active,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }
}

export type CreateProfileRecord = {
  ownerKey: string
  kind: ProfileKind
  name: string
  sources: SourceRef[]
  mergedTags: string[]
  styleSummary: string
  channel?: Channel
  isActive?: boolean
}

/** Insert a new profile. If isActive, it becomes the owner's sole active profile. */
export async function createProfile(rec: CreateProfileRecord): Promise<VoiceProfile> {
  await ensureSchema()
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (rec.isActive) {
      await client.query('UPDATE voice_profiles SET is_active = false WHERE owner_key = $1', [rec.ownerKey])
    }
    const id = randomUUID()
    const { rows } = await client.query<Row>(
      `INSERT INTO voice_profiles (id, owner_key, kind, name, sources, merged_tags, style_summary, channel, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
       RETURNING *`,
      [
        id,
        rec.ownerKey,
        rec.kind,
        rec.name,
        JSON.stringify(rec.sources),
        JSON.stringify(rec.mergedTags),
        rec.styleSummary,
        rec.channel ?? 'x',
        Boolean(rec.isActive),
      ],
    )
    await client.query('COMMIT')
    return mapRow(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Save a generated/edited Style Guide (+ its short summary) onto an own-voice profile. */
export async function setStyleGuide(
  ownerKey: string,
  id: string,
  guide: { guideMarkdown: string; summary: string },
): Promise<VoiceProfile | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `UPDATE voice_profiles SET style_guide = $1, style_summary = $2, updated_at = now()
     WHERE owner_key = $3 AND id = $4 AND deleted_at IS NULL RETURNING *`,
    [guide.guideMarkdown, guide.summary, ownerKey, id],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** List an owner's profiles (soft-deleted excluded), active first, then newest. */
export async function listProfiles(ownerKey: string): Promise<VoiceProfile[]> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `SELECT * FROM voice_profiles WHERE owner_key = $1 AND deleted_at IS NULL ORDER BY is_active DESC, created_at DESC`,
    [ownerKey],
  )
  return rows.map(mapRow)
}

/** Fetch one profile, scoped to its owner. Soft-deleted profiles read as absent. */
export async function getProfile(ownerKey: string, id: string): Promise<VoiceProfile | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `SELECT * FROM voice_profiles WHERE owner_key = $1 AND id = $2 AND deleted_at IS NULL`,
    [ownerKey, id],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export type ProfilePatch = {
  name?: string
  sources?: SourceRef[]
  mergedTags?: string[]
  styleSummary?: string
}

/** Update mutable fields. Returns the updated row, or null if not found for this owner. */
export async function updateProfile(
  ownerKey: string,
  id: string,
  patch: ProfilePatch,
): Promise<VoiceProfile | null> {
  await ensureSchema()
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`)
    vals.push(patch.name)
  }
  if (patch.sources !== undefined) {
    sets.push(`sources = $${i++}::jsonb`)
    vals.push(JSON.stringify(patch.sources))
  }
  if (patch.mergedTags !== undefined) {
    sets.push(`merged_tags = $${i++}::jsonb`)
    vals.push(JSON.stringify(patch.mergedTags))
  }
  if (patch.styleSummary !== undefined) {
    sets.push(`style_summary = $${i++}`)
    vals.push(patch.styleSummary)
  }
  if (sets.length === 0) return getProfile(ownerKey, id)

  sets.push(`updated_at = now()`)
  vals.push(ownerKey, id)
  const { rows } = await getPool().query<Row>(
    `UPDATE voice_profiles SET ${sets.join(', ')} WHERE owner_key = $${i++} AND id = $${i} AND deleted_at IS NULL RETURNING *`,
    vals,
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Soft-delete a profile: it disappears from every read but keeps its style
 *  guide and samples, so restoreProfile brings it back losslessly. Returns true
 *  if a (live) row was marked. */
export async function deleteProfile(ownerKey: string, id: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query(
    `UPDATE voice_profiles SET deleted_at = now(), is_active = false, updated_at = now()
     WHERE owner_key = $1 AND id = $2 AND deleted_at IS NULL`,
    [ownerKey, id],
  )
  return (rowCount ?? 0) > 0
}

/** Undo a soft delete. Comes back INACTIVE (never silently steals the active
 *  slot); the user re-picks it if they want it active. Returns the profile. */
export async function restoreProfile(ownerKey: string, id: string): Promise<VoiceProfile | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `UPDATE voice_profiles SET deleted_at = NULL, updated_at = now()
     WHERE owner_key = $1 AND id = $2 AND deleted_at IS NOT NULL RETURNING *`,
    [ownerKey, id],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Clear the active flag on a profile. Returns it, or null if not found. */
export async function deactivateProfile(ownerKey: string, id: string): Promise<VoiceProfile | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    'UPDATE voice_profiles SET is_active = false, updated_at = now() WHERE owner_key = $1 AND id = $2 AND deleted_at IS NULL RETURNING *',
    [ownerKey, id],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Make `id` the owner's sole active profile. Returns it, or null if not found. */
export async function setActiveProfile(ownerKey: string, id: string): Promise<VoiceProfile | null> {
  await ensureSchema()
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query(
      'SELECT 1 FROM voice_profiles WHERE owner_key = $1 AND id = $2 AND deleted_at IS NULL',
      [ownerKey, id],
    )
    if (found.rowCount === 0) {
      await client.query('ROLLBACK')
      return null
    }
    // Unset others BEFORE setting this one, so the partial-unique index never trips.
    await client.query(
      'UPDATE voice_profiles SET is_active = false, updated_at = now() WHERE owner_key = $1 AND id <> $2 AND is_active',
      [ownerKey, id],
    )
    const { rows } = await client.query<Row>(
      'UPDATE voice_profiles SET is_active = true, updated_at = now() WHERE owner_key = $1 AND id = $2 RETURNING *',
      [ownerKey, id],
    )
    await client.query('COMMIT')
    return mapRow(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
