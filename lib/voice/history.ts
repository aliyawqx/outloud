import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import type { ChatTurnRecord, DraftPost, HistoryEntry, ReplyTarget } from './types'

// Persistence for compose sessions (the History panel). Owner-scoped.

type Row = {
  id: string
  voice_profile_id: string | null
  voice_name: string
  idea: string
  drafts: DraftPost[]
  messages: ChatTurnRecord[] | null
  reply_to: ReplyTarget | null
  created_at: Date
}

function mapRow(r: Row): HistoryEntry {
  return {
    id: r.id,
    voiceProfileId: r.voice_profile_id,
    voiceName: r.voice_name,
    idea: r.idea,
    drafts: r.drafts ?? [],
    messages: r.messages ?? [],
    replyTo: r.reply_to ?? null,
    createdAt: r.created_at.toISOString(),
  }
}

export async function saveComposeSession(input: {
  ownerKey: string
  voiceProfileId: string | null
  voiceName: string
  idea: string
  drafts: DraftPost[]
  messages?: ChatTurnRecord[]
  replyTo?: ReplyTarget | null
}): Promise<HistoryEntry> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `INSERT INTO compose_history (id, owner_key, voice_profile_id, voice_name, idea, drafts, messages, reply_to)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb) RETURNING *`,
    [
      randomUUID(),
      input.ownerKey,
      input.voiceProfileId,
      input.voiceName,
      input.idea,
      JSON.stringify(input.drafts),
      JSON.stringify(input.messages ?? []),
      input.replyTo ? JSON.stringify(input.replyTo) : null,
    ],
  )
  return mapRow(rows[0])
}

/** Replace a chat's drafts + full transcript (a chat stays ONE history entry,
 *  updated in place as new drafts are generated). */
export async function updateComposeChat(
  ownerKey: string,
  id: string,
  input: { drafts: DraftPost[]; messages: ChatTurnRecord[] },
): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE compose_history SET drafts = $3::jsonb, messages = $4::jsonb WHERE owner_key = $1 AND id = $2`,
    [ownerKey, id, JSON.stringify(input.drafts), JSON.stringify(input.messages)],
  )
}

/** Rename a chat — updates the title (idea) shown in the History sidebar. */
export async function renameComposeEntry(ownerKey: string, id: string, idea: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query(
    `UPDATE compose_history SET idea = $3 WHERE owner_key = $1 AND id = $2`,
    [ownerKey, id, idea],
  )
  return (rowCount ?? 0) > 0
}

/** One entry, scoped to its owner — used to reopen a session in the composer. */
export async function getComposeEntry(ownerKey: string, id: string): Promise<HistoryEntry | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    `SELECT * FROM compose_history WHERE owner_key = $1 AND id = $2`,
    [ownerKey, id],
  )
  return rows[0] ? mapRow(rows[0]) : null
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
