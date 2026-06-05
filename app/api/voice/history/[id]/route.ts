import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { deleteComposeEntry } from '@/lib/voice/history'

// DELETE /api/voice/history/:id — remove a saved compose session.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  const removed = await deleteComposeEntry(session.userId, id)
  if (!removed) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
