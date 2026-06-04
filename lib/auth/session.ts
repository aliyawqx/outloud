import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

// Stateless sessions: a signed JWT in an httpOnly cookie. jose is edge-safe, so
// the same verify runs in middleware. No DB lookup per request.

export const SESSION_COOKIE = 'outloud_session'
const MAX_AGE_S = 60 * 60 * 24 * 30 // 30 days

export type Session = { userId: string; email: string }

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(s)
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret())
}

/** Verify a raw token (used by middleware on the edge and by getSession). */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!payload.sub || typeof payload.email !== 'string') return null
    return { userId: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

/** Read the current session from the request cookies (server components / routes). */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return verifySessionToken(token)
}

export async function setSessionCookie(token: string): Promise<void> {
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  })
}

export async function clearSessionCookie(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}
