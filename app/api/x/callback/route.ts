import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { xConfig } from '@/lib/x/config'
import { exchangeCode } from '@/lib/x/oauth'
import { openOAuthTx, X_OAUTH_COOKIE } from '@/lib/x/stateCookie'
import { getMe } from '@/lib/x/client'
import { saveAccount } from '@/lib/x/store'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const back = new URL('/app/profile', req.url)

  const txToken = (await cookies()).get(X_OAUTH_COOKIE)?.value
  const tx = await openOAuthTx(txToken)

  if (!code || !state || !tx || tx.state !== state) {
    back.searchParams.set('x', 'error')
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
    console.error('[x/callback] failed:', err)
    back.searchParams.set('x', 'error')
  }

  const res = NextResponse.redirect(back)
  res.cookies.delete(X_OAUTH_COOKIE)
  return res
}
