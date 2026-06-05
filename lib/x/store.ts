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
}

export type SaveAccountInput = {
  userId: string
  xUserId: string
  username: string
  accessToken: string
  refreshToken?: string
  scope: string
  expiresAt: Date
}

type Row = {
  user_id: string
  x_user_id: string
  username: string
  access_token_enc: string
  refresh_token_enc: string | null
  scope: string
  expires_at: Date
}

const REFRESH_SKEW_MS = 60_000

/** True when the token is expired or will expire within the refresh skew. */
export function isExpiring(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_SKEW_MS
}

export async function saveAccount(i: SaveAccountInput): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `INSERT INTO x_accounts (user_id, x_user_id, username, access_token_enc, refresh_token_enc, scope, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       x_user_id = EXCLUDED.x_user_id,
       username = EXCLUDED.username,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       scope = EXCLUDED.scope,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()`,
    [
      i.userId,
      i.xUserId,
      i.username,
      encryptToken(i.accessToken),
      i.refreshToken ? encryptToken(i.refreshToken) : null,
      i.scope,
      i.expiresAt,
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
  }
}

export async function deleteAccount(userId: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query('DELETE FROM x_accounts WHERE user_id = $1', [userId])
  return (rowCount ?? 0) > 0
}

/** A usable access token, refreshing transparently when it is expiring. */
export async function getValidAccessToken(userId: string): Promise<string> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>('SELECT * FROM x_accounts WHERE user_id = $1', [userId])
  const r = rows[0]
  if (!r) throw new XNotConnectedError()

  if (!isExpiring(r.expires_at, new Date())) return decryptToken(r.access_token_enc)
  if (!r.refresh_token_enc) throw new XAuthError()

  const { clientId, clientSecret } = xConfig()
  const tok = await refreshToken({
    refreshToken: decryptToken(r.refresh_token_enc),
    clientId,
    clientSecret,
  })
  await saveAccount({
    userId,
    xUserId: r.x_user_id,
    username: r.username,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token ?? decryptToken(r.refresh_token_enc),
    scope: tok.scope,
    expiresAt: new Date(Date.now() + tok.expires_in * 1000),
  })
  return tok.access_token
}
