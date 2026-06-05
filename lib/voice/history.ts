import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import type { DraftPost, HistoryEntry } from './types'

// Persistence for compose sessions (the History panel). Owner-scoped.

type Row = {
  id: string
  voice_profile_id: string | null
  voice_name: string
  idea: string
  drafts: DraftPost[]
  created_at: Date
}

function mapRow(r: Row): HistoryEntry {
  return {
    id: r.id,
    voiceProfileId: r.voice_profile_id,
    voiceName: r.voice_name,
    idea: r.idea,
    drafts: r.drafts ?? [],
    createdAt: r.created_at.toISOString(),
  }
}

export async function saveComposeSession(input: {
  ownerKey: string
  voiceProfileId: string | null
  voiceName: string
  idea: string
  drafts: DraftPost[]
}): Promise<HistoryEntry> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `INSERT INTO compose_history (id, owner_key, voice_profile_id, voice_name, idea, drafts)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
    [randomUUID(), input.ownerKey, input.voiceProfileId, input.voiceName, input.idea, JSON.stringify(input.drafts)],
  )
  return mapRow(rows[0])
}

export async function listComposeHistory(ownerKey: string, limit = 50): Promise<HistoryEntry[]> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `SELECT * FROM compose_history WHERE owner_key = $1 ORDER BY created_at DESC LIMIT ${Number(limit)}`,
    [ownerKey],
  )
  return rows.map(mapRow)
}

export async function deleteComposeEntry(ownerKey: string, id: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query(
    `DELETE FROM compose_history WHERE owner_key = $1 AND id = $2`,
    [ownerKey, id],
  )
  return (rowCount ?? 0) > 0
}
