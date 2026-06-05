import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { xConfig } from '@/lib/x/config'
import { buildAuthUrl, makePkce, makeState } from '@/lib/x/oauth'
import { sealOAuthTx, X_OAUTH_COOKIE, X_OAUTH_MAX_AGE_S } from '@/lib/x/stateCookie'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const { clientId, redirectUri } = xConfig()
  const { verifier, challenge } = makePkce()
  const state = makeState()

  const res = NextResponse.redirect(buildAuthUrl({ clientId, redirectUri, state, challenge }))
  res.cookies.set(X_OAUTH_COOKIE, await sealOAuthTx({ state, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: X_OAUTH_MAX_AGE_S,
  })
  return res
}
