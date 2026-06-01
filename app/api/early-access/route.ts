import { NextRequest, NextResponse } from 'next/server'
import { validateSignup, type SignupInput } from '@/lib/validateSignup'
import { ensureSchema, upsertSignup } from '@/lib/db'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateSignup((body ?? {}) as SignupInput)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  try {
    await ensureSchema()
    const { alreadyOnList } = await upsertSignup(result.value)
    return NextResponse.json({ ok: true, alreadyOnList })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
