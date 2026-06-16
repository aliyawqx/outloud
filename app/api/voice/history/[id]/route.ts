import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { deleteComposeEntry, renameComposeEntry } from '@/lib/voice/history'

// DELETE /api/voice/history/:id — remove a saved compose session.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  const removed = await deleteComposeEntry(session.userId, id)
  if (!removed) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/voice/history/:id — rename a saved compose session.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const title = typeof (body as { title?: unknown })?.title === 'string' ? (body as { title: string }).title.trim() : ''
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })

  const renamed = await renameComposeEntry(session.userId, id, title.slice(0, 200))
  if (!renamed) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
