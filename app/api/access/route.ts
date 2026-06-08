import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { setIncubator } from '@/lib/profile/store'

// POST /api/access — record whether the user is an nFactorial incubator participant.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const v = (body as { incubator?: unknown }).incubator
  if (v !== 'yes' && v !== 'no') return NextResponse.json({ error: 'Invalid answer.' }, { status: 400 })

  await setIncubator(session.userId, v)
  return NextResponse.json({ ok: true, incubator: v })
}
