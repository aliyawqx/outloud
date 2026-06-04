import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_MAX_AGE_S, verifySessionToken, type Session } from './jwt'

// Cookie-bound session helpers (server components / route handlers). The pure
// token logic lives in ./jwt so middleware can verify on the edge.
export { createSessionToken, verifySessionToken, SESSION_COOKIE } from './jwt'
export type { Session } from './jwt'

/** Read + verify the current session from the request cookies. */
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
    maxAge: SESSION_MAX_AGE_S,
  })
}

export async function clearSessionCookie(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}
