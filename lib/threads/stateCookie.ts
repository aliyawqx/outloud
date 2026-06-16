import { SignJWT, jwtVerify } from 'jose'

// The CSRF state, sealed into a short-lived signed cookie that /connect sets and
// /callback reads. Mirrors lib/x/stateCookie.ts. Threads has no PKCE verifier, so
// only `state` (and an optional returnTo) travel in the cookie.

export const THREADS_OAUTH_COOKIE = 'threads_oauth_tx'
export const THREADS_OAUTH_MAX_AGE_S = 600 // 10 minutes

export type OAuthTx = { state: string; returnTo?: string }

// Where to land after the OAuth round-trip. Only same-origin app paths are
// allowed (no protocol-relative "//host" or absolute URLs) to prevent an open
// redirect. Anything else falls back to the profile page.
export function safeReturnTo(raw: string | null | undefined): string {
  const fallback = '/app/profile'
  if (!raw || typeof raw !== 'string') return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (!raw.startsWith('/app')) return fallback
  return raw
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(s)
}

export async function sealOAuthTx(tx: OAuthTx): Promise<string> {
  return new SignJWT({ state: tx.state, ...(tx.returnTo ? { returnTo: tx.returnTo } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${THREADS_OAUTH_MAX_AGE_S}s`)
    .sign(secret())
}

export async function openOAuthTx(token: string | undefined): Promise<OAuthTx | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.state !== 'string') return null
    const returnTo = typeof payload.returnTo === 'string' ? payload.returnTo : undefined
    return { state: payload.state, returnTo }
  } catch {
    return null
  }
}
