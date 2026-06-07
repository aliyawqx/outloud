import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import { SEED_PROMPTS, seedText } from './seeds'

// The built-in "Outloud" format prompts are read-only and live in code (seeds.ts).
// This table stores ONLY the user's own custom prompts. Generation prefers a custom
// prompt for a command, falling back to the built-in seed.

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

const SEED_COMMANDS = new Set(SEED_PROMPTS.map((s) => s.command))

/** Normalize a slash command: lowercase, no leading "/", a-z0-9 and dashes only. */
export function normalizeCommand(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9-]/g, '').slice(0, 32)
}

/** Thrown when a command name collides with a built-in or an existing custom one. */
export class CommandTakenError extends Error {
  constructor() {
    super('That command name is taken. Pick another.')
    this.name = 'CommandTakenError'
  }
}

/** The user's CUSTOM prompts only (built-in seeds are read-only, not stored). */
export async function listPrompts(ownerKey: string): Promise<Prompt[]> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>(
    'SELECT * FROM prompts WHERE owner_key = $1 ORDER BY created_at ASC',
    [ownerKey],
  )
  return rows.map(mapRow)
}

/** FORMAT text for a command: the user's custom prompt wins, else the built-in seed. */
export async function getPromptText(ownerKey: string, command: string): Promise<string | null> {
  await ensureSchema()
  const cmd = normalizeCommand(command)
  const { rows } = await getPool().query<Row>(
    'SELECT text FROM prompts WHERE owner_key = $1 AND command = $2',
    [ownerKey, cmd],
  )
  return rows[0]?.text ?? seedText(cmd) ?? null
}

export async function createPrompt(
  ownerKey: string,
  input: { command: string; title: string; text: string },
): Promise<Prompt> {
  await ensureSchema()
  const command = normalizeCommand(input.command)
  if (SEED_COMMANDS.has(command)) throw new CommandTakenError() // built-in names are reserved
  try {
    const { rows } = await getPool().query<Row>(
      `INSERT INTO prompts (id, owner_key, command, title, text) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [randomUUID(), ownerKey, command, input.title.trim(), input.text.trim()],
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
  if (patch.command !== undefined && SEED_COMMANDS.has(normalizeCommand(patch.command))) {
    throw new CommandTakenError()
  }
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
