import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import { hashPassword } from './password'
import { isCardFreeTrialEmail } from '@/lib/appLock'
import { PLAN_ALLOWANCE, FREE_RESET_DAYS } from '@/lib/creditsConfig'

export type AuthUser = { id: string; email: string }

/** Thrown when signing up with an email that already has an account. */
export class EmailTakenError extends Error {
  constructor() {
    super('That email is already registered.')
    this.name = 'EmailTakenError'
  }
}

/** Create a user + their 1:1 profile in one transaction. */
export async function createUser(input: {
  email: string
  password: string
  displayName: string
}): Promise<AuthUser> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const id = randomUUID()
    const hash = await hashPassword(input.password)
    await client.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [
      id,
      input.email,
      hash,
    ])
    if (isCardFreeTrialEmail(input.email)) {
      // EXISTING-user treatment: a 7-day card-free window with 10k credits, NO Polar.
      // trialing + no subscription → resetIfDue expires it to 0 after 7 days, then the
      // user must subscribe (charged immediately, since trial_used=true).
      const resetAt = new Date(Date.now() + FREE_RESET_DAYS * 86_400_000)
      const pool = PLAN_ALLOWANCE.free
      await client.query(
        `INSERT INTO profiles (user_id, display_name, email, trialing, trial_used, credit_balance, credits_reset_at)
         VALUES ($1, $2, $3, true, true, $4, $5)`,
        [id, input.displayName, input.email, pool, resetAt],
      )
      await client.query(
        'INSERT INTO credit_ledger (id, user_id, amount, reason, balance_after, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [randomUUID(), id, pool, 'grant', pool, JSON.stringify({ cardFreeWindow: true })],
      )
    } else {
      // NEW user: start at 0 on the free plan → the trial gate makes them pick a plan +
      // add a card to start the Polar 7-day trial (then auto-bills on day 7).
      await client.query(
        'INSERT INTO profiles (user_id, display_name, email, credit_balance, credits_reset_at) VALUES ($1, $2, $3, 0, NULL)',
        [id, input.displayName, input.email],
      )
    }
    await client.query('COMMIT')
    return { id, email: input.email }
  } catch (err) {
    await client.query('ROLLBACK')
    if ((err as { code?: string }).code === '23505') throw new EmailTakenError()
    throw err
  } finally {
    client.release()
  }
}

export type UserRecord = { id: string; email: string; passwordHash: string }

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureSchema()
  const { rows } = await getPool().query<{ id: string; email: string; password_hash: string }>(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email],
  )
  return rows[0] ? { id: rows[0].id, email: rows[0].email, passwordHash: rows[0].password_hash } : null
}

/**
 * Permanently delete a user and ALL their data. profiles + x_accounts cascade off
 * the users FK; the owner_key-keyed tables (voice_profiles → writing_samples,
 * compose_history, prompts) have no FK to users, so we clear them explicitly. All
 * in one transaction so a partial failure leaves nothing half-deleted.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    // voice_profiles deletion cascades writing_samples via their FK.
    await client.query('DELETE FROM voice_profiles WHERE owner_key = $1', [userId])
    await client.query('DELETE FROM compose_history WHERE owner_key = $1', [userId])
    await client.query('DELETE FROM prompts WHERE owner_key = $1', [userId])
    // users deletion cascades profiles + x_accounts via their FKs.
    await client.query('DELETE FROM users WHERE id = $1', [userId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
