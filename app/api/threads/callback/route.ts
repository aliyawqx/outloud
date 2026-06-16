import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { threadsConfig } from '@/lib/threads/config'
import { exchangeCode, exchangeLongLived, threadsScopes } from '@/lib/threads/oauth'
import { openOAuthTx, safeReturnTo, THREADS_OAUTH_COOKIE } from '@/lib/threads/stateCookie'
import { getMe } from '@/lib/threads/client'
import { saveAccount } from '@/lib/threads/store'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const txToken = (await cookies()).get(THREADS_OAUTH_COOKIE)?.value
  const tx = await openOAuthTx(txToken)
  // Return to wherever the connect started (onboarding vs profile); default profile.
  const back = new URL(safeReturnTo(tx?.returnTo), req.url)

  if (!code || !state || !tx || tx.state !== state) {
    back.searchParams.set('threads', 'error')
    const res = NextResponse.redirect(back)
    res.cookies.delete(THREADS_OAUTH_COOKIE)
    return res
  }

  try {
    const { clientId, clientSecret, redirectUri } = threadsConfig()
    // code → short-lived token (+ user id) → long-lived token (60 days).
    const short = await exchangeCode({ code, clientId, clientSecret, redirectUri })
    const long = await exchangeLongLived({ shortToken: short.access_token, clientSecret })
    const me = await getMe(long.access_token)
    await saveAccount({
      userId: session.userId,
      threadsUserId: me.id,
      username: me.username,
      accessToken: long.access_token,
      scope: threadsScopes(),
      expiresAt: new Date(Date.now() + long.expires_in * 1000),
    })
    back.searchParams.set('threads', 'connected')
  } catch (err) {
    console.error('[threads/callback] failed:', err)
    back.searchParams.set('threads', 'error')
  }

  const res = NextResponse.redirect(back)
  res.cookies.delete(THREADS_OAUTH_COOKIE)
  return res
}
