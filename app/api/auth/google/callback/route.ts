import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/jwt'
import { SESSION_MAX_AGE_S } from '@/lib/auth/jwt'
import { AFTER_LOGIN, AFTER_SIGNUP } from '@/lib/auth/redirects'
import { readSignupRef } from '@/lib/auth/ref'
import { getUserByEmail, createOAuthUser, EmailTakenError } from '@/lib/auth/users'
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  googleConfigured,
  googleRedirectUri,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_NEXT_COOKIE,
} from '@/lib/auth/google'

function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : ''
}

// GET /api/auth/google/callback — Google redirects here with ?code&state. Verify the
// state, exchange the code, look up (or create) the user by email, set the session, and
// land them in the app (new users → onboarding, returning → dashboard).
export async function GET(req: Request) {
  const url = new URL(req.url)
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, req.url))

  if (!googleConfigured()) return fail('google_unavailable')

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const jar = await cookies()
  const expectedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  const next = safeNext(jar.get(GOOGLE_OAUTH_NEXT_COOKIE)?.value)
  // Clear the one-time OAuth cookies regardless of outcome.
  jar.delete(GOOGLE_OAUTH_STATE_COOKIE)
  jar.delete(GOOGLE_OAUTH_NEXT_COOKIE)

  if (url.searchParams.get('error')) return fail('google')
  if (!code || !state || !expectedState || state !== expectedState) return fail('google')

  try {
    const accessToken = await exchangeGoogleCode({ code, redirectUri: googleRedirectUri(url.origin) })
    const profile = await fetchGoogleProfile(accessToken)
    if (!profile.email) return fail('google')

    // Find by email = account linking: a returning user (whether they first signed up
    // with email/password or Google) is logged in; a new email becomes a new account.
    let user = await getUserByEmail(profile.email)
    let isNew = false
    if (!user) {
      try {
        const created = await createOAuthUser({
          email: profile.email,
          displayName: profile.name || profile.email.split('@')[0],
          // Launch attribution (?ref=...) captured on first landing; null if absent.
          signupRef: await readSignupRef(),
        })
        user = { id: created.id, email: created.email, passwordHash: '' }
        isNew = true
      } catch (e) {
        // Race: created between the lookup and insert → just log that account in.
        if (e instanceof EmailTakenError) user = await getUserByEmail(profile.email)
        else throw e
      }
    }
    if (!user) return fail('google')

    const token = await createSessionToken({ userId: user.id, email: user.email })
    const dest = next || (isNew ? AFTER_SIGNUP : AFTER_LOGIN)
    const res = NextResponse.redirect(new URL(dest, req.url))
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_S,
    })
    return res
  } catch (err) {
    console.error('[auth/google/callback] failed:', err)
    return fail('google')
  }
}
