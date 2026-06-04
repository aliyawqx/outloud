import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt'
import { SIGNUP_PATH } from '@/lib/auth/redirects'

// Guard the signed-in app and the (now protected) voices route. Logged-out
// visitors are sent to sign-up with their intended destination preserved.
export async function middleware(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = SIGNUP_PATH
  url.searchParams.set('next', req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/app/:path*', '/voices/:path*'],
}
