import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { linkedinConfig } from '@/lib/linkedin/config'
import { buildAuthUrl, makeState } from '@/lib/linkedin/oauth'
import {
  LINKEDIN_OAUTH_COOKIE,
  LINKEDIN_OAUTH_MAX_AGE_S,
  safeReturnTo,
  sealOAuthTx,
} from '@/lib/linkedin/stateCookie'

// GET /api/linkedin/connect — start the 3-legged OAuth round-trip (spec §2).
// State is kept in a SIGNED httpOnly cookie (CSRF); no PKCE — LinkedIn
// authenticates the exchange with the client secret, server-side only.
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const { clientId, redirectUri } = linkedinConfig()
  const state = makeState()
  // Where to send the user back after connecting (e.g. onboarding vs profile).
  const returnTo = safeReturnTo(new URL(req.url).searchParams.get('returnTo'))

  const res = NextResponse.redirect(buildAuthUrl({ clientId, redirectUri, state }))
  res.cookies.set(LINKEDIN_OAUTH_COOKIE, await sealOAuthTx({ state, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LINKEDIN_OAUTH_MAX_AGE_S,
  })
  return res
}
