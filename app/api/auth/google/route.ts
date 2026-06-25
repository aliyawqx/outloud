import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  googleConfigured,
  googleAuthUrl,
  googleRedirectUri,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_MAX_AGE_S,
} from '@/lib/auth/google'

/** Only allow internal redirect targets after sign-in. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : ''
}

// GET /api/auth/google — start the Google OAuth flow. Sets a CSRF state cookie (and the
// intended post-login destination) and redirects to Google's consent screen.
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/login?error=google_unavailable', req.url))
  }

  const state = randomBytes(16).toString('hex')
  const redirectUri = googleRedirectUri(url.origin)
  const next = safeNext(url.searchParams.get('next'))

  const res = NextResponse.redirect(googleAuthUrl({ state, redirectUri }))
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: GOOGLE_OAUTH_MAX_AGE_S,
  }
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOpts)
  res.cookies.set(GOOGLE_OAUTH_NEXT_COOKIE, next, cookieOpts)
  return res
}
