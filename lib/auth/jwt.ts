import { SignJWT, jwtVerify } from 'jose'

// Pure JWT helpers — NO next/headers import, so this is safe to use from edge
// middleware. Cookie read/write lives in session.ts (server components/routes).

export const SESSION_COOKIE = 'outloud_session'
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30 // 30 days

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
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(secret())
}

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
