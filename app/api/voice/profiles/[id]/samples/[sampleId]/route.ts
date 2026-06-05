import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { deleteSample, toggleSample } from '@/lib/voice/samples'

type Ctx = { params: Promise<{ id: string; sampleId: string }> }

// PATCH /api/voice/profiles/:id/samples/:sampleId — toggle "used in style".
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { sampleId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const usedInStyle = (body as { usedInStyle?: unknown }).usedInStyle
  if (typeof usedInStyle !== 'boolean') {
    return NextResponse.json({ error: 'usedInStyle must be a boolean.' }, { status: 400 })
  }

  const sample = await toggleSample(session.userId, sampleId, usedInStyle)
  if (!sample) return NextResponse.json({ error: 'Sample not found.' }, { status: 404 })
  return NextResponse.json({ sample })
}

// DELETE /api/voice/profiles/:id/samples/:sampleId
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { sampleId } = await params

  const removed = await deleteSample(session.userId, sampleId)
  if (!removed) return NextResponse.json({ error: 'Sample not found.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
