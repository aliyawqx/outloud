import { ensureSchema, getPool } from '@/lib/db'
import { linkedinConfig } from './config'
import { decryptToken, encryptToken } from './crypto'
import { LinkedInAuthError, LinkedInNotConnectedError } from './errors'
import { refreshAccessToken } from './oauth'

// Storage/refresh mirrors lib/x/store.ts (nullable refresh token, FOR UPDATE
// serialized refresh) with Threads' long skew: the token lives ~60 days, so we
// refresh a week early. If there is NO refresh token (Default tier norm), an
// expiring/dead token flips status to 'needs_reconnect' — re-auth is the only
// recovery (spec §5).

const REFRESH_SKEW_MS = 7 * 86_400_000

export function isExpiring(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_SKEW_MS
}

export type LinkedInAccount = {
  userId: string
  linkedinMemberId: string
  personUrn: string
  displayName: string
  scope: string
  status: 'connected' | 'needs_reconnect'
  expiresAt: Date
  hasRefreshToken: boolean
}

export type SaveAccountInput = {
  userId: string
  linkedinMemberId: string
  personUrn: string
  displayName: string
  accessToken: string
  refreshToken?: string
  refreshTokenExpiresAt?: Date | null
  scope: string
  expiresAt: Date
}

export async function saveAccount(i: SaveAccountInput): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `INSERT INTO linkedin_accounts
       (user_id, linkedin_member_id, person_urn, display_name, access_token_enc,
        refresh_token_enc, scope, status, expires_at, refresh_token_expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'connected',$8,$9)
     ON CONFLICT (user_id) DO UPDATE SET
       linkedin_member_id = EXCLUDED.linkedin_member_id,
       person_urn = EXCLUDED.person_urn,
       display_name = EXCLUDED.display_name,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       scope = EXCLUDED.scope,
       status = 'connected',
       expires_at = EXCLUDED.expires_at,
       refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
       updated_at = now()`,
    [
      i.userId,
      i.linkedinMemberId,
      i.personUrn,
      i.displayName,
      encryptToken(i.accessToken),
      i.refreshToken ? encryptToken(i.refreshToken) : null,
      i.scope,
      i.expiresAt,
      i.refreshTokenExpiresAt ?? null,
    ],
  )
}

type Row = {
  user_id: string
  linkedin_member_id: string
  person_urn: string
  display_name: string
  access_token_enc: string
  refresh_token_enc: string | null
  scope: string
  status: 'connected' | 'needs_reconnect'
  expires_at: Date
  refresh_token_expires_at: Date | null
}

export async function getAccount(userId: string): Promise<LinkedInAccount | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(`SELECT * FROM linkedin_accounts WHERE user_id = $1`, [userId])
  const row = r.rows[0]
  if (!row) return null
  return {
    userId: row.user_id,
    linkedinMemberId: row.linkedin_member_id,
    personUrn: row.person_urn,
    displayName: row.display_name,
    scope: row.scope,
    status: row.status,
    expiresAt: row.expires_at,
    hasRefreshToken: Boolean(row.refresh_token_enc),
  }
}

export async function deleteAccount(userId: string): Promise<boolean> {
  await ensureSchema()
  const r = await getPool().query(`DELETE FROM linkedin_accounts WHERE user_id = $1`, [userId])
  return (r.rowCount ?? 0) > 0
}

/** Publish 401 / failed refresh → the connection is dead until re-auth (spec §5). */
export async function markNeedsReconnect(userId: string): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE linkedin_accounts SET status = 'needs_reconnect', updated_at = now() WHERE user_id = $1`,
    [userId],
  )
}

/**
 * Valid access token for API calls, refreshing under a row lock when possible.
 * FOR UPDATE serializes concurrent refreshes (publish cron + manual publish)
 * so a rotated refresh token is never lost — same pattern as lib/x/store.ts.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const r = await client.query<Row>(`SELECT * FROM linkedin_accounts WHERE user_id = $1 FOR UPDATE`, [userId])
    const row = r.rows[0]
    if (!row) {
      await client.query('ROLLBACK')
      throw new LinkedInNotConnectedError()
    }
    const now = new Date()
    if (!isExpiring(row.expires_at, now)) {
      await client.query('COMMIT')
      return decryptToken(row.access_token_enc)
    }
    const refreshUsable =
      row.refresh_token_enc && (!row.refresh_token_expires_at || row.refresh_token_expires_at > now)
    if (!refreshUsable) {
      // No (usable) refresh token — mark dead in the same transaction, then re-auth.
      await client.query(
        `UPDATE linkedin_accounts SET status = 'needs_reconnect', updated_at = now() WHERE user_id = $1`,
        [userId],
      )
      await client.query('COMMIT')
      throw new LinkedInAuthError()
    }
    const { clientId, clientSecret } = linkedinConfig()
    const tok = await refreshAccessToken({
      refreshToken: decryptToken(row.refresh_token_enc as string),
      clientId,
      clientSecret,
    })
    await client.query(
      `UPDATE linkedin_accounts SET
         access_token_enc = $2,
         refresh_token_enc = $3,
         expires_at = $4,
         refresh_token_expires_at = $5,
         status = 'connected',
         updated_at = now()
       WHERE user_id = $1`,
      [
        userId,
        encryptToken(tok.access_token),
        tok.refresh_token ? encryptToken(tok.refresh_token) : row.refresh_token_enc, // rotation-safe
        new Date(Date.now() + tok.expires_in * 1000),
        tok.refresh_token_expires_in
          ? new Date(Date.now() + tok.refresh_token_expires_in * 1000)
          : row.refresh_token_expires_at,
      ],
    )
    await client.query('COMMIT')
    return tok.access_token
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err instanceof LinkedInAuthError) {
      // Refresh call itself failed → dead connection.
      await markNeedsReconnect(userId).catch(() => {})
    }
    throw err
  } finally {
    client.release()
  }
}
