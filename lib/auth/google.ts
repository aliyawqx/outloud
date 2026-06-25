// Google OAuth 2.0 (Authorization Code) helpers for "Continue with Google" sign-in.
// Needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. The redirect URI defaults to
// `${origin}/api/auth/google/callback` (override with GOOGLE_REDIRECT_URI) and must be
// registered in the Google Cloud console's OAuth client.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export const GOOGLE_OAUTH_STATE_COOKIE = 'g_oauth_state'
export const GOOGLE_OAUTH_NEXT_COOKIE = 'g_oauth_next'
export const GOOGLE_OAUTH_MAX_AGE_S = 60 * 10 // 10 minutes to complete the round-trip

export function googleConfigured(): boolean {
  return Boolean((process.env.GOOGLE_CLIENT_ID ?? '').trim() && (process.env.GOOGLE_CLIENT_SECRET ?? '').trim())
}

const clientId = () => (process.env.GOOGLE_CLIENT_ID ?? '').trim()
const clientSecret = () => (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()

export function googleRedirectUri(origin: string): string {
  return (process.env.GOOGLE_REDIRECT_URI ?? '').trim() || `${origin}/api/auth/google/callback`
}

export function googleAuthUrl(opts: { state: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: opts.state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `${AUTH_URL}?${params.toString()}`
}

/** Exchange the authorization code for an access token. */
export async function exchangeGoogleCode(opts: { code: string; redirectUri: string }): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`)
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error('google token exchange returned no access_token')
  return data.access_token
}

export type GoogleProfile = { email: string; name: string; emailVerified: boolean }

/** Fetch the signed-in Google user's profile (email + name). */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`)
  const u = (await res.json()) as { email?: string; name?: string; given_name?: string; email_verified?: boolean }
  return {
    email: String(u.email ?? '').trim().toLowerCase(),
    name: String(u.name ?? u.given_name ?? '').trim(),
    emailVerified: Boolean(u.email_verified),
  }
}
