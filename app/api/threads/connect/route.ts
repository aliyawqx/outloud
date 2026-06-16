import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { threadsConfig } from '@/lib/threads/config'
import { buildAuthUrl, makeState } from '@/lib/threads/oauth'
import { safeReturnTo, sealOAuthTx, THREADS_OAUTH_COOKIE, THREADS_OAUTH_MAX_AGE_S } from '@/lib/threads/stateCookie'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const { clientId, redirectUri } = threadsConfig()
  const state = makeState()
  // Where to send the user back after connecting (e.g. onboarding vs profile).
  const returnTo = safeReturnTo(new URL(req.url).searchParams.get('returnTo'))

  const res = NextResponse.redirect(buildAuthUrl({ clientId, redirectUri, state }))
  res.cookies.set(THREADS_OAUTH_COOKIE, await sealOAuthTx({ state, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: THREADS_OAUTH_MAX_AGE_S,
  })
  return res
}
