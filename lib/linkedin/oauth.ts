import { randomBytes } from 'node:crypto'
import { LinkedInAuthError } from './errors'

// 3-legged OAuth (spec §2). No PKCE — LinkedIn authenticates the exchange with
// the client secret (server-side only), like the Threads flow. The token
// response MAY include a refresh_token (approved-partner feature) — never
// assume it's present (spec §5).

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'

export const LINKEDIN_SCOPES = 'openid profile email w_member_social'

export type TokenResponse = {
  access_token: string
  expires_in: number // ~5_184_000s = 60 days
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
}

export function makeState(): string {
  return randomBytes(16).toString('base64url')
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', p.clientId)
  url.searchParams.set('redirect_uri', p.redirectUri)
  url.searchParams.set('state', p.state)
  url.searchParams.set('scope', LINKEDIN_SCOPES)
  return url.toString()
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[linkedin/oauth] token request failed: %d %s', res.status, text.slice(0, 300))
    throw new LinkedInAuthError()
  }
  return (await res.json()) as TokenResponse
}

export async function exchangeCode(p: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: p.code,
      redirect_uri: p.redirectUri,
      client_id: p.clientId,
      client_secret: p.clientSecret,
    }),
  )
}

export async function refreshAccessToken(p: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: p.refreshToken,
      client_id: p.clientId,
      client_secret: p.clientSecret,
    }),
  )
}

/** OpenID userinfo — the `sub` field is the member id; the post author is
 *  `urn:li:person:{sub}`. Fetched ONCE at connect time and cached (spec §3). */
export async function fetchUserinfo(accessToken: string): Promise<{ sub: string; name: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[linkedin/oauth] userinfo failed: %d %s', res.status, text.slice(0, 300))
    throw new LinkedInAuthError()
  }
  const data = (await res.json()) as { sub?: string; name?: string }
  if (!data.sub) throw new LinkedInAuthError()
  return { sub: data.sub, name: data.name ?? '' }
}
