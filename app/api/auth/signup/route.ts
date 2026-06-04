import { NextResponse } from 'next/server'
import { validateSignup } from '@/lib/auth/validateCredentials'
import { createUser, EmailTakenError } from '@/lib/auth/users'
import { createSessionToken, setSessionCookie } from '@/lib/auth/session'
import { AFTER_SIGNUP } from '@/lib/auth/redirects'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateSignup(body)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  try {
    const user = await createUser(result.value)
    const token = await createSessionToken({ userId: user.id, email: user.email })
    await setSessionCookie(token)
    return NextResponse.json({ ok: true, redirect: AFTER_SIGNUP }, { status: 201 })
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[signup] failed:', err)
    return NextResponse.json({ error: 'Could not create your account. Try again.' }, { status: 500 })
  }
}
