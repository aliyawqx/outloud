import { randomUUID, randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { ensureSchema, getPool } from '@/lib/db'
import { hashPassword } from './password'
import { PLAN_ALLOWANCE, FREE_RESET_DAYS } from '@/lib/creditsConfig'
import { isStaff } from '@/lib/appLock'

export type AuthUser = { id: string; email: string }

/** Thrown when signing up with an email that already has an account. */
export class EmailTakenError extends Error {
  constructor() {
    super('That email is already registered.')
    this.name = 'EmailTakenError'
  }
}

/** Provision the 1:1 profile + opening trial grant for a freshly inserted user.
 *  Every new account starts on a card-free trial: a 3-day window with 10k credits and
 *  NO Polar / no card capture. `trialing` + no subscription id → resetIfDue ends it when
 *  the window elapses; spending the 10k also ends it. Then the user picks a paid plan. */
async function provisionTrialProfile(client: PoolClient, id: string, displayName: string, email: string): Promise<void> {
  // Founder/staff emails get the Founder plan (unlimited via isStaff) provisioned up
  // front, so it's ready the moment they sign up — no manual DB step, whether they've
  // registered yet or not. Resets a month out; metering is skipped for staff anyway.
  if (isStaff(email)) {
    const founderReset = new Date(Date.now() + 30 * 86_400_000)
    const founderPool = PLAN_ALLOWANCE.founder
    await client.query(
      `INSERT INTO profiles (user_id, display_name, email, plan, trialing, trial_used, credit_balance, credits_reset_at)
       VALUES ($1, $2, $3, 'founder', false, true, $4, $5)`,
      [id, displayName, email, founderPool, founderReset],
    )
    await client.query(
      'INSERT INTO credit_ledger (id, user_id, amount, reason, balance_after, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [randomUUID(), id, founderPool, 'grant', founderPool, JSON.stringify({ founder: true })],
    )
    return
  }
  const resetAt = new Date(Date.now() + FREE_RESET_DAYS * 86_400_000)
  const pool = PLAN_ALLOWANCE.free
  await client.query(
    `INSERT INTO profiles (user_id, display_name, email, trialing, trial_used, credit_balance, credits_reset_at)
     VALUES ($1, $2, $3, true, true, $4, $5)`,
    [id, displayName, email, pool, resetAt],
  )
  await client.query(
    'INSERT INTO credit_ledger (id, user_id, amount, reason, balance_after, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
    [randomUUID(), id, pool, 'grant', pool, JSON.stringify({ cardFreeWindow: true })],
  )
}

/** Create an email/password user + their 1:1 profile in one transaction. */
export async function createUser(input: {
  email: string
  password: string
  displayName: string
  /** Launch attribution (e.g. 'ph') read from the signup_ref cookie; null when absent. */
  signupRef?: string | null
}): Promise<AuthUser> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const id = randomUUID()
    const hash = await hashPassword(input.password)
    await client.query('INSERT INTO users (id, email, password_hash, signup_ref) VALUES ($1, $2, $3, $4)', [
      id,
      input.email,
      hash,
      input.signupRef ?? null,
    ])
    await provisionTrialProfile(client, id, input.displayName, input.email)
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

/** Create a user from a verified OAuth identity (e.g. Google). No usable password
 *  (a random hash satisfies the NOT NULL column; the user signs in via the provider),
 *  and email_verified=true since the provider already verified ownership — so they skip
 *  the email-code gate. Same card-free trial as email signup. */
export async function createOAuthUser(input: {
  email: string
  displayName: string
  /** Launch attribution (e.g. 'ph') read from the signup_ref cookie; null when absent. */
  signupRef?: string | null
}): Promise<AuthUser> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const id = randomUUID()
    // Random, unknown-to-anyone hash — there's no password to log in with.
    const hash = await hashPassword(randomBytes(24).toString('hex'))
    await client.query(
      'INSERT INTO users (id, email, password_hash, email_verified, signup_ref) VALUES ($1, $2, $3, true, $4)',
      [id, input.email, hash, input.signupRef ?? null],
    )
    await provisionTrialProfile(client, id, input.displayName, input.email)
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
