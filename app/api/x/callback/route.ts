import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { xConfig } from '@/lib/x/config'
import { exchangeCode } from '@/lib/x/oauth'
import { openOAuthTx, safeReturnTo, X_OAUTH_COOKIE } from '@/lib/x/stateCookie'
import { getMe } from '@/lib/x/client'
import { saveAccount } from '@/lib/x/store'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const txToken = (await cookies()).get(X_OAUTH_COOKIE)?.value
  const tx = await openOAuthTx(txToken)
  // Return to wherever the connect started (onboarding vs profile); default profile.
  const back = new URL(safeReturnTo(tx?.returnTo), req.url)

  // The denial / state-mismatch case (no usable code, or the CSRF/cookie didn't survive
  // the round-trip — often an expired tx cookie or a host mismatch on the redirect URL).
  if (url.searchParams.get('error') || !code || !state || !tx || tx.state !== state) {
    console.error('[x/callback] state/denied:', {
      providerError: url.searchParams.get('error'),
      hasCode: Boolean(code),
      hasTx: Boolean(tx),
      stateMatch: tx ? tx.state === state : false,
    })
    back.searchParams.set('x', 'error')
    back.searchParams.set('xr', url.searchParams.get('error') ? 'denied' : 'state')
    const res = NextResponse.redirect(back)
    res.cookies.delete(X_OAUTH_COOKIE)
    return res
  }

  try {
    const { clientId, clientSecret, redirectUri } = xConfig()
    const tok = await exchangeCode({ code, verifier: tx.verifier, clientId, clientSecret, redirectUri })
    const me = await getMe(tok.access_token)
    await saveAccount({
      userId: session.userId,
      xUserId: me.id,
      username: me.username,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      scope: tok.scope,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    })
    back.searchParams.set('x', 'connected')
  } catch (err) {
    // Token exchange / profile fetch failed — almost always a redirect_uri or client
    // credential mismatch between this app's env and the X app settings. The real reason
    // is logged in lib/x/oauth tokenRequest.
    console.error('[x/callback] auth failed:', err)
    back.searchParams.set('x', 'error')
    back.searchParams.set('xr', 'auth')
  }

  const res = NextResponse.redirect(back)
  res.cookies.delete(X_OAUTH_COOKIE)
  return res
}
