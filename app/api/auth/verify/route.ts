import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { verifyCode } from '@/lib/auth/verify'

// POST /api/auth/verify — check the 6-digit code the user entered after signup.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const code = (body as { code?: unknown }).code
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 })
  }

  const result = await verifyCode(session.userId, code)
  switch (result) {
    case 'ok':
    case 'already':
      return NextResponse.json({ ok: true })
    case 'expired':
      return NextResponse.json({ error: 'That code has expired. Request a new one.' }, { status: 400 })
    case 'invalid':
    default:
      return NextResponse.json({ error: "That code isn't right. Check it and try again." }, { status: 400 })
  }
}
