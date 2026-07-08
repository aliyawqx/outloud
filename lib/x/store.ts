import { ensureSchema, getPool } from '@/lib/db'
import { decryptToken, encryptToken } from './crypto'
import { xConfig } from './config'
import { refreshToken } from './oauth'
import { XAuthError, XNotConnectedError } from './errors'

export type XAccount = {
  userId: string
  xUserId: string
  username: string
  scope: string
  expiresAt: string
  /** verified_type from users/me at connect time ('blue' | 'business' | …); null = unknown/legacy row. */
  verifiedType: string | null
  /** Premium (any verified_type but 'none') unlocks long-form posts past 280 chars. */
  premium: boolean
}

export type SaveAccountInput = {
  userId: string
  xUserId: string
  username: string
  accessToken: string
  refreshToken?: string
  scope: string
  expiresAt: Date
  verifiedType?: string | null
}

type Row = {
  user_id: string
  x_user_id: string
  username: string
  access_token_enc: string
  refresh_token_enc: string | null
  scope: string
  expires_at: Date
  verified_type: string | null
}

const isPremium = (verifiedType: string | null): boolean => Boolean(verifiedType && verifiedType !== 'none')

const REFRESH_SKEW_MS = 60_000

/** True when the token is expired or will expire within the refresh skew. */
export function isExpiring(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_SKEW_MS
}

export async function saveAccount(i: SaveAccountInput): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `INSERT INTO x_accounts (user_id, x_user_id, username, access_token_enc, refresh_token_enc, scope, expires_at, verified_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE SET
       x_user_id = EXCLUDED.x_user_id,
       username = EXCLUDED.username,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       scope = EXCLUDED.scope,
       expires_at = EXCLUDED.expires_at,
       verified_type = EXCLUDED.verified_type,
       updated_at = now()`,
    [
      i.userId,
      i.xUserId,
      i.username,
      encryptToken(i.accessToken),
      i.refreshToken ? encryptToken(i.refreshToken) : null,
      i.scope,
      i.expiresAt,
      i.verifiedType ?? null,
    ],
  )
}

export async function getAccount(userId: string): Promise<XAccount | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>('SELECT * FROM x_accounts WHERE user_id = $1', [userId])
  const r = rows[0]
  if (!r) return null
  return {
    userId: r.user_id,
    xUserId: r.x_user_id,
    username: r.username,
    scope: r.scope,
    expiresAt: r.expires_at.toISOString(),
    verifiedType: r.verified_type,
    premium: isPremium(r.verified_type),
  }
}

export async function deleteAccount(userId: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query('DELETE FROM x_accounts WHERE user_id = $1', [userId])
  return (rowCount ?? 0) > 0
}

/**
 * A usable access token, refreshing transparently when it is expiring.
 *
 * The refresh is serialized with a row lock (`SELECT ... FOR UPDATE`): X rotates
 * the refresh token on every refresh, so concurrent requests (or two deployments
 * on the same DB) must not refresh in parallel — otherwise the loser refreshes
 * with an already-rotated token and the whole connection breaks. Under the lock,
 * the first caller refreshes and the rest read the fresh token. The connection
 * therefore stays valid until the user disconnects here or revokes access on X.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<Row>('SELECT * FROM x_accounts WHERE user_id = $1 FOR UPDATE', [userId])
    const r = rows[0]
    if (!r) {
      await client.query('ROLLBACK')
      throw new XNotConnectedError()
    }

    // Re-read under the lock: a concurrent request may have just refreshed it.
    if (!isExpiring(r.expires_at, new Date())) {
      await client.query('COMMIT')
      return decryptToken(r.access_token_enc)
    }
    if (!r.refresh_token_enc) {
      await client.query('ROLLBACK')
      throw new XAuthError()
    }

    const { clientId, clientSecret } = xConfig()
    const tok = await refreshToken({
      refreshToken: decryptToken(r.refresh_token_enc),
      clientId,
      clientSecret,
    })
    // Persist the rotated tokens within the same transaction (still holding the lock).
    await client.query(
      `UPDATE x_accounts
         SET access_token_enc = $2, refresh_token_enc = $3, scope = $4, expires_at = $5, updated_at = now()
       WHERE user_id = $1`,
      [
        userId,
        encryptToken(tok.access_token),
        encryptToken(tok.refresh_token ?? decryptToken(r.refresh_token_enc)),
        tok.scope,
        new Date(Date.now() + tok.expires_in * 1000),
      ],
    )
    await client.query('COMMIT')
    return tok.access_token
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
