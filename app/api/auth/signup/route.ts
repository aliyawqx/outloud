import { NextResponse } from 'next/server'
import { validateSignup } from '@/lib/auth/validateCredentials'
import { readSignupRef } from '@/lib/auth/ref'
import { createUser, EmailTakenError } from '@/lib/auth/users'
import { createSessionToken, setSessionCookie } from '@/lib/auth/session'
import { AFTER_SIGNUP } from '@/lib/auth/redirects'
import { setVerifyCode } from '@/lib/auth/verify'
import { sendVerificationCode } from '@/lib/auth/email'

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
    // Attach launch attribution (?ref=...) captured on first landing; null if absent.
    const signupRef = await readSignupRef()
    const user = await createUser({ ...result.value, signupRef })
    const token = await createSessionToken({ userId: user.id, email: user.email })
    await setSessionCookie(token)
    // Send the email-verification code. Best-effort: a failure here must NOT block
    // the signup — the user can request a fresh code from the verify screen.
    try {
      const code = await setVerifyCode(user.id)
      await sendVerificationCode(user.email, code)
    } catch (mailErr) {
      console.error('[signup] verification code send failed (non-fatal):', mailErr)
    }
    return NextResponse.json({ ok: true, redirect: AFTER_SIGNUP }, { status: 201 })
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[signup] failed:', err)
    return NextResponse.json({ error: 'Could not create your account. Try again.' }, { status: 500 })
  }
}
