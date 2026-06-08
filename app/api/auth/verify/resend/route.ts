import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { isEmailVerified, setVerifyCode } from '@/lib/auth/verify'
import { sendVerificationCode } from '@/lib/auth/email'

// POST /api/auth/verify/resend — issue a fresh code and email it again.
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  // Already verified → nothing to do (don't leak a new code).
  if (await isEmailVerified(session.userId)) {
    return NextResponse.json({ ok: true, alreadyVerified: true })
  }

  try {
    const code = await setVerifyCode(session.userId)
    await sendVerificationCode(session.email, code)
  } catch (err) {
    console.error('[verify/resend] failed:', err)
    return NextResponse.json({ error: "Couldn't send a new code. Try again." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
