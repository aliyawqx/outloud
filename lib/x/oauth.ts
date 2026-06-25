import { createHash, randomBytes } from 'node:crypto'
import { XAuthError } from './errors'

const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
// media.write enables v2 media upload (images on tweets) — but it is NOT grantable on
// the FREE X API tier: requesting it makes X's consent fail with "You weren't able to
// give access to the App". So it's gated behind X_REQUEST_MEDIA_SCOPE: leave it unset
// and X login/connect works; set it to "1" once the X app is on a paid tier (Basic+)
// that allows the scope. The image-upload code stays wired either way.
const BASE_X_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
export const X_MEDIA_SCOPE_ENABLED = process.env.X_REQUEST_MEDIA_SCOPE === '1'
export const X_SCOPES = (
  X_MEDIA_SCOPE_ENABLED ? ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'] : BASE_X_SCOPES
).join(' ')

export type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function makePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function makeState(): string {
  return base64url(randomBytes(16))
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const u = new URL(AUTHORIZE_URL)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', p.clientId)
  u.searchParams.set('redirect_uri', p.redirectUri)
  u.searchParams.set('scope', X_SCOPES)
  u.searchParams.set('state', p.state)
  u.searchParams.set('code_challenge', p.challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  return u.toString()
}

function basicAuth(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

async function tokenRequest(body: URLSearchParams, clientId: string, clientSecret: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basicAuth(clientId, clientSecret) },
    body,
  })
  if (!res.ok) {
    // Surface WHY (don't swallow) — X returns the real reason here, almost always a
    // redirect_uri mismatch or invalid_client. Logged so it shows in server logs.
    const detail = await res.text().catch(() => '')
    console.error('[x/oauth] token request failed:', res.status, detail.slice(0, 500))
    throw new XAuthError(`X token request failed (${res.status})`)
  }
  return (await res.json()) as TokenResponse
}

export async function exchangeCode(p: {
  code: string
  verifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: p.code,
    redirect_uri: p.redirectUri,
    code_verifier: p.verifier,
    client_id: p.clientId,
  })
  return tokenRequest(body, p.clientId, p.clientSecret)
}

export async function refreshToken(p: { refreshToken: string; clientId: string; clientSecret: string }): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: p.refreshToken,
    client_id: p.clientId,
  })
  return tokenRequest(body, p.clientId, p.clientSecret)
}
