import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import { SEED_PROMPTS } from './seeds'

// Per-user library of FORMAT prompts (slash commands). Owner-scoped, seeded from
// SEED_PROMPTS on first use, then fully editable by the user.

export type Prompt = {
  id: string
  command: string
  title: string
  text: string
  createdAt: string
  updatedAt: string
}

type Row = { id: string; command: string; title: string; text: string; created_at: Date; updated_at: Date }
const mapRow = (r: Row): Prompt => ({
  id: r.id,
  command: r.command,
  title: r.title,
  text: r.text,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
})

/** Normalize a slash command: lowercase, no leading "/", a-z0-9 and dashes only. */
export function normalizeCommand(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9-]/g, '').slice(0, 32)
}

/** Copy the seed library into a user's prompts the first time they have none. */
export async function ensurePromptsSeeded(ownerKey: string): Promise<void> {
  await ensureSchema()
  const pool = getPool()
  const { rows } = await pool.query<{ n: string }>('SELECT count(*)::text AS n FROM prompts WHERE owner_key = $1', [ownerKey])
  if (Number(rows[0]?.n ?? '0') > 0) return
  // Insert seeds; ON CONFLICT DO NOTHING guards against a concurrent first load.
  for (const s of SEED_PROMPTS) {
    await pool.query(
      `INSERT INTO prompts (id, owner_key, command, title, text)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (owner_key, command) DO NOTHING`,
      [randomUUID(), ownerKey, s.command, s.title, s.text],
    )
  }
}

export async function listPrompts(ownerKey: string): Promise<Prompt[]> {
  await ensurePromptsSeeded(ownerKey)
  const { rows } = await getPool().query<Row>(
    'SELECT * FROM prompts WHERE owner_key = $1 ORDER BY created_at ASC',
    [ownerKey],
  )
  return rows.map(mapRow)
}

/** The FORMAT text for a command, or null if the user has no such command. */
export async function getPromptText(ownerKey: string, command: string): Promise<string | null> {
  await ensurePromptsSeeded(ownerKey)
  const { rows } = await getPool().query<Row>(
    'SELECT * FROM prompts WHERE owner_key = $1 AND command = $2',
    [ownerKey, normalizeCommand(command)],
  )
  return rows[0]?.text ?? null
}

/** Thrown when a command name collides with an existing one for this user. */
export class CommandTakenError extends Error {
  constructor() {
    super('You already have a command with that name.')
    this.name = 'CommandTakenError'
  }
}

export async function createPrompt(
  ownerKey: string,
  input: { command: string; title: string; text: string },
): Promise<Prompt> {
  await ensurePromptsSeeded(ownerKey)
  try {
    const { rows } = await getPool().query<Row>(
      `INSERT INTO prompts (id, owner_key, command, title, text) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [randomUUID(), ownerKey, normalizeCommand(input.command), input.title.trim(), input.text.trim()],
    )
    return mapRow(rows[0])
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new CommandTakenError()
    throw err
  }
}

export async function updatePrompt(
  ownerKey: string,
  id: string,
  patch: { command?: string; title?: string; text?: string },
): Promise<Prompt | null> {
  await ensureSchema()
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  if (patch.command !== undefined) { sets.push(`command = $${i++}`); vals.push(normalizeCommand(patch.command)) }
  if (patch.title !== undefined) { sets.push(`title = $${i++}`); vals.push(patch.title.trim()) }
  if (patch.text !== undefined) { sets.push(`text = $${i++}`); vals.push(patch.text.trim()) }
  if (sets.length === 0) {
    const { rows } = await getPool().query<Row>('SELECT * FROM prompts WHERE owner_key = $1 AND id = $2', [ownerKey, id])
    return rows[0] ? mapRow(rows[0]) : null
  }
  sets.push('updated_at = now()')
  vals.push(ownerKey, id)
  try {
    const { rows } = await getPool().query<Row>(
      `UPDATE prompts SET ${sets.join(', ')} WHERE owner_key = $${i++} AND id = $${i} RETURNING *`,
      vals,
    )
    return rows[0] ? mapRow(rows[0]) : null
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new CommandTakenError()
    throw err
  }
}

export async function deletePrompt(ownerKey: string, id: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query('DELETE FROM prompts WHERE owner_key = $1 AND id = $2', [ownerKey, id])
  return (rowCount ?? 0) > 0
}
