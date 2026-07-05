import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { linkedinConfig } from '@/lib/linkedin/config'
import { exchangeCode, fetchUserinfo } from '@/lib/linkedin/oauth'
import { saveAccount } from '@/lib/linkedin/store'
import { LINKEDIN_OAUTH_COOKIE, openOAuthTx, safeReturnTo } from '@/lib/linkedin/stateCookie'

// GET /api/linkedin/callback — exchange the code, fetch userinfo (person URN,
// spec §3), persist the connection. Lands back on the profile page with
// ?linkedin=connected | ?linkedin=error&lir=denied|state|auth.
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const providerError = url.searchParams.get('error')

  const txToken = (await cookies()).get(LINKEDIN_OAUTH_COOKIE)?.value
  const tx = await openOAuthTx(txToken)
  // Return to wherever the connect started (onboarding vs profile); default profile.
  const back = new URL(safeReturnTo(tx?.returnTo), req.url)

  const fail = (reason: 'denied' | 'state' | 'auth') => {
    back.searchParams.set('linkedin', 'error')
    back.searchParams.set('lir', reason)
    const res = NextResponse.redirect(back)
    res.cookies.delete(LINKEDIN_OAUTH_COOKIE)
    return res
  }

  if (providerError) return fail('denied')
  if (!code || !state || !tx || tx.state !== state) return fail('state')

  try {
    const { clientId, clientSecret, redirectUri } = linkedinConfig()
    const tok = await exchangeCode({ code, clientId, clientSecret, redirectUri })
    // Fetch the member id ONCE at connect time; the post author is this URN (spec §3).
    const { sub, name } = await fetchUserinfo(tok.access_token)
    await saveAccount({
      userId: session.userId,
      linkedinMemberId: sub,
      personUrn: `urn:li:person:${sub}`,
      displayName: name,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token, // may be absent on Default tier — nullable (spec §5)
      refreshTokenExpiresAt: tok.refresh_token_expires_in
        ? new Date(Date.now() + tok.refresh_token_expires_in * 1000)
        : null,
      scope: tok.scope ?? '',
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    })
    back.searchParams.set('linkedin', 'connected')
    const res = NextResponse.redirect(back)
    res.cookies.delete(LINKEDIN_OAUTH_COOKIE)
    return res
  } catch (err) {
    console.error('[linkedin/callback] failed:', err)
    return fail('auth')
  }
}
