import { NextResponse } from 'next/server'
import { validateLogin } from '@/lib/auth/validateCredentials'
import { getUserByEmail } from '@/lib/auth/users'
import { verifyPassword } from '@/lib/auth/password'
import { createSessionToken, setSessionCookie } from '@/lib/auth/session'
import { AFTER_LOGIN } from '@/lib/auth/redirects'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateLogin(body)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  try {
    const user = await getUserByEmail(result.value.email)
    // Same generic message whether the email or the password is wrong.
    const ok = user ? await verifyPassword(result.value.password, user.passwordHash) : false
    if (!user || !ok) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const token = await createSessionToken({ userId: user.id, email: user.email })
    await setSessionCookie(token)
    return NextResponse.json({ ok: true, redirect: AFTER_LOGIN })
  } catch (err) {
    console.error('[login] failed:', err)
    return NextResponse.json({ error: 'Could not sign you in. Try again.' }, { status: 500 })
  }
}
