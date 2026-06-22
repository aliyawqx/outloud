import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt'
import { SIGNUP_PATH } from '@/lib/auth/redirects'

// Guard the signed-in app and the (now protected) voices route. Logged-out
// visitors are sent to sign-up with their intended destination preserved.
export async function middleware(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (session) {
    // Forward the path so server layouts can branch on it (e.g. exempt /app/voices
    // and /app/onboarding from the onboarding gate). `headers()` reads request headers.
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pathname', req.nextUrl.pathname)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const url = req.nextUrl.clone()
  url.pathname = SIGNUP_PATH
  url.searchParams.set('next', req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/app/:path*', '/voices/:path*'],
}
