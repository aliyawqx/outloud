import { randomBytes } from 'node:crypto'
import { ThreadsAuthError } from './errors'

// Threads (Meta) OAuth. Unlike X, Threads does not use PKCE — it authenticates the
// token exchange with the app secret. CSRF is still guarded with a `state` value
// carried in a signed cookie (see stateCookie.ts).

const AUTHORIZE_URL = 'https://threads.net/oauth/authorize'
const SHORT_TOKEN_URL = 'https://graph.threads.net/oauth/access_token'
const LONG_TOKEN_URL = 'https://graph.threads.net/access_token'
const REFRESH_URL = 'https://graph.threads.net/refresh_access_token'

// threads_manage_replies is required to publish replies (reply_to_id).
export const THREADS_SCOPES = 'threads_basic,threads_content_publish,threads_manage_replies'

// Don't let a slow/hanging Meta call spin the OAuth callback forever — fail fast
// so the user gets a clean "couldn't connect" instead of an endless redirect.
const TOKEN_TIMEOUT_MS = 10_000

// Topic search (keyword_search) needs threads_keyword_search, which Meta gates
// behind app review. Requesting an unapproved scope can break the authorize step,
// so it's only added when the operator opts in via THREADS_KEYWORD_SEARCH=1 — i.e.
// once the app has been approved for it. See lib/threads/search.ts.
export const THREADS_KEYWORD_SEARCH_SCOPE = 'threads_keyword_search'

export function keywordSearchEnabled(): boolean {
  return process.env.THREADS_KEYWORD_SEARCH === '1'
}

/** The scopes actually requested at connect time (and stored on the account). */
export function threadsScopes(): string {
  return keywordSearchEnabled() ? `${THREADS_SCOPES},${THREADS_KEYWORD_SEARCH_SCOPE}` : THREADS_SCOPES
}

export type ShortTokenResponse = { access_token: string; user_id: string }
export type LongTokenResponse = { access_token: string; token_type: string; expires_in: number }

export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function makeState(): string {
  return base64url(randomBytes(16))
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL(AUTHORIZE_URL)
  u.searchParams.set('client_id', p.clientId)
  u.searchParams.set('redirect_uri', p.redirectUri)
  u.searchParams.set('scope', threadsScopes())
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('state', p.state)
  return u.toString()
}

/** Exchange the authorization code for a SHORT-lived token (~1h) + the user id. */
export async function exchangeCode(p: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<ShortTokenResponse> {
  const body = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: p.redirectUri,
    // Meta appends "#_" to the code on the redirect; strip any trailing fragment.
    code: p.code.replace(/#_$/, ''),
  })
  let res: Response
  try {
    res = await fetch(SHORT_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    })
  } catch {
    throw new ThreadsAuthError()
  }
  if (!res.ok) throw new ThreadsAuthError()
  const data = (await res.json().catch(() => null)) as { access_token?: string; user_id?: string | number } | null
  if (!data?.access_token || data.user_id == null) throw new ThreadsAuthError()
  return { access_token: data.access_token, user_id: String(data.user_id) }
}

/** Exchange a short-lived token for a LONG-lived one (60 days). */
export async function exchangeLongLived(p: { shortToken: string; clientSecret: string }): Promise<LongTokenResponse> {
  const u = new URL(LONG_TOKEN_URL)
  u.searchParams.set('grant_type', 'th_exchange_token')
  u.searchParams.set('client_secret', p.clientSecret)
  u.searchParams.set('access_token', p.shortToken)
  return getLongToken(u)
}

/** Refresh a long-lived token (60 days). Only valid when the token is unexpired
 *  and at least 24h old — the caller enforces that by refreshing before expiry. */
export async function refreshLongLived(p: { longToken: string }): Promise<LongTokenResponse> {
  const u = new URL(REFRESH_URL)
  u.searchParams.set('grant_type', 'th_refresh_token')
  u.searchParams.set('access_token', p.longToken)
  return getLongToken(u)
}

async function getLongToken(u: URL): Promise<LongTokenResponse> {
  let res: Response
  try {
    res = await fetch(u, { method: 'GET', signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS) })
  } catch {
    throw new ThreadsAuthError()
  }
  if (!res.ok) throw new ThreadsAuthError()
  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; token_type?: string; expires_in?: number }
    | null
  if (!data?.access_token || typeof data.expires_in !== 'number') throw new ThreadsAuthError()
  return { access_token: data.access_token, token_type: data.token_type ?? 'bearer', expires_in: data.expires_in }
}
