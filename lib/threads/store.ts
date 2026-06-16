import { ensureSchema, getPool } from '@/lib/db'
import { decryptToken, encryptToken } from './crypto'
import { refreshLongLived } from './oauth'
import { ThreadsAuthError, ThreadsNotConnectedError } from './errors'

export type ThreadsAccount = {
  userId: string
  threadsUserId: string
  username: string
  scope: string
  expiresAt: string
}

export type SaveAccountInput = {
  userId: string
  threadsUserId: string
  username: string
  accessToken: string
  scope: string
  expiresAt: Date
}

type Row = {
  user_id: string
  threads_user_id: string
  username: string
  access_token_enc: string
  scope: string
  expires_at: Date
}

// Threads long-lived tokens last 60 days and are self-refreshing (the access token
// IS what gets refreshed — there is no separate refresh token). We refresh well
// ahead of expiry so any publish in the final stretch keeps the connection alive;
// Meta also requires the token be unexpired and ≥24h old, both trivially true here.
const REFRESH_SKEW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/** True when the token is expired or will expire within the refresh skew. */
export function isExpiring(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_SKEW_MS
}

export async function saveAccount(i: SaveAccountInput): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `INSERT INTO threads_accounts (user_id, threads_user_id, username, access_token_enc, scope, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       threads_user_id = EXCLUDED.threads_user_id,
       username = EXCLUDED.username,
       access_token_enc = EXCLUDED.access_token_enc,
       scope = EXCLUDED.scope,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()`,
    [i.userId, i.threadsUserId, i.username, encryptToken(i.accessToken), i.scope, i.expiresAt],
  )
}

export async function getAccount(userId: string): Promise<ThreadsAccount | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>('SELECT * FROM threads_accounts WHERE user_id = $1', [userId])
  const r = rows[0]
  if (!r) return null
  return {
    userId: r.user_id,
    threadsUserId: r.threads_user_id,
    username: r.username,
    scope: r.scope,
    expiresAt: r.expires_at.toISOString(),
  }
}

export async function deleteAccount(userId: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query('DELETE FROM threads_accounts WHERE user_id = $1', [userId])
  return (rowCount ?? 0) > 0
}

/**
 * A usable access token, refreshing transparently when it is expiring. Serialized
 * with a row lock (`SELECT ... FOR UPDATE`) so concurrent requests (or two
 * deployments on the same DB) don't refresh in parallel — mirrors lib/x/store.ts.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<Row>('SELECT * FROM threads_accounts WHERE user_id = $1 FOR UPDATE', [userId])
    const r = rows[0]
    if (!r) {
      await client.query('ROLLBACK')
      throw new ThreadsNotConnectedError()
    }

    // Re-read under the lock: a concurrent request may have just refreshed it.
    if (!isExpiring(r.expires_at, new Date())) {
      await client.query('COMMIT')
      return decryptToken(r.access_token_enc)
    }

    const tok = await refreshLongLived({ longToken: decryptToken(r.access_token_enc) })
    await client.query(
      `UPDATE threads_accounts
         SET access_token_enc = $2, expires_at = $3, updated_at = now()
       WHERE user_id = $1`,
      [userId, encryptToken(tok.access_token), new Date(Date.now() + tok.expires_in * 1000)],
    )
    await client.query('COMMIT')
    return tok.access_token
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    // A refresh that fails (token revoked or lapsed past 60 days) → reconnect.
    if (err instanceof ThreadsNotConnectedError) throw err
    if (err instanceof ThreadsAuthError) throw err
    throw err
  } finally {
    client.release()
  }
}
