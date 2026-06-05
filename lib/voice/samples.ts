import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import type { SampleSource, WritingSample } from './types'

// Writing samples for own-voice capture. All queries scope by owner_key so one
// user can never read or mutate another's samples.

type Row = {
  id: string
  voice_profile_id: string
  source: string
  text: string
  used_in_style: boolean
  created_at: Date
}

function mapRow(r: Row): WritingSample {
  return {
    id: r.id,
    voiceProfileId: r.voice_profile_id,
    source: r.source as SampleSource,
    text: r.text,
    usedInStyle: r.used_in_style,
    createdAt: r.created_at.toISOString(),
  }
}

/** Insert one or more samples for a profile. Returns the created rows. */
export async function addSamples(
  ownerKey: string,
  voiceProfileId: string,
  items: { source: SampleSource; text: string }[],
): Promise<WritingSample[]> {
  await ensureSchema()
  const created: WritingSample[] = []
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const item of items) {
      const { rows } = await client.query<Row>(
        `INSERT INTO writing_samples (id, voice_profile_id, owner_key, source, text)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [randomUUID(), voiceProfileId, ownerKey, item.source, item.text],
      )
      created.push(mapRow(rows[0]))
    }
    await client.query('COMMIT')
    return created
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** All samples for a profile, newest first. */
export async function listSamples(ownerKey: string, voiceProfileId: string): Promise<WritingSample[]> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `SELECT * FROM writing_samples WHERE owner_key = $1 AND voice_profile_id = $2 ORDER BY created_at DESC`,
    [ownerKey, voiceProfileId],
  )
  return rows.map(mapRow)
}

/** The text of enabled samples, newest first, capped to `limit` (for draft anchors). */
export async function listEnabledTexts(
  ownerKey: string,
  voiceProfileId: string,
  limit?: number,
): Promise<string[]> {
  await ensureSchema()
  const { rows } = await getPool().query<{ text: string }>(
    `SELECT text FROM writing_samples
     WHERE owner_key = $1 AND voice_profile_id = $2 AND used_in_style
     ORDER BY created_at DESC ${limit ? 'LIMIT ' + Number(limit) : ''}`,
    [ownerKey, voiceProfileId],
  )
  return rows.map((r) => r.text)
}

export async function toggleSample(
  ownerKey: string,
  voiceProfileId: string,
  id: string,
  usedInStyle: boolean,
): Promise<WritingSample | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `UPDATE writing_samples SET used_in_style = $1
     WHERE owner_key = $2 AND voice_profile_id = $3 AND id = $4 RETURNING *`,
    [usedInStyle, ownerKey, voiceProfileId, id],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function deleteSample(ownerKey: string, voiceProfileId: string, id: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query(
    `DELETE FROM writing_samples WHERE owner_key = $1 AND voice_profile_id = $2 AND id = $3`,
    [ownerKey, voiceProfileId, id],
  )
  return (rowCount ?? 0) > 0
}
