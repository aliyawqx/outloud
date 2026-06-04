import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, updateProfile } from '@/lib/profile/store'
import { validateProfileUpdate } from '@/lib/profile/validate'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  return NextResponse.json({ profile: await getProfile(session.userId) })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateProfileUpdate(body)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const profile = await updateProfile(session.userId, result.value)
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
  return NextResponse.json({ profile })
}
