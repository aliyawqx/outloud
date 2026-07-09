import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { restoreProfile } from '@/lib/voice/store'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/voice/profiles/:id/restore — undo a soft delete (the "Undo" in the
// voices list). Only reachable for the owner's own soft-deleted profiles.
export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  try {
    const profile = await restoreProfile(session.userId, id)
    if (!profile) return NextResponse.json({ error: 'Nothing to restore.' }, { status: 404 })
    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json({ error: 'Could not restore your voice.' }, { status: 500 })
  }
}
