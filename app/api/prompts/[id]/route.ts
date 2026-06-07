import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { CommandTakenError, deletePrompt, updatePrompt } from '@/lib/prompts/store'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/prompts/[id] — edit a command (seeded or custom).
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>
  const patch: { command?: string; title?: string; text?: string } = {}
  if (typeof b.command === 'string') patch.command = b.command
  if (typeof b.title === 'string') patch.title = b.title
  if (typeof b.text === 'string') patch.text = b.text
  if (patch.title !== undefined && !patch.title.trim()) return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 })
  if (patch.text !== undefined && !patch.text.trim()) return NextResponse.json({ error: 'Prompt text cannot be empty.' }, { status: 400 })

  try {
    const prompt = await updatePrompt(session.userId, id, patch)
    if (!prompt) return NextResponse.json({ error: 'Prompt not found.' }, { status: 404 })
    return NextResponse.json({ prompt })
  } catch (err) {
    if (err instanceof CommandTakenError) return NextResponse.json({ error: err.message }, { status: 409 })
    console.error('[prompts] update failed:', err)
    return NextResponse.json({ error: 'Could not save that prompt. Try again.' }, { status: 500 })
  }
}

// DELETE /api/prompts/[id]
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  await deletePrompt(session.userId, id)
  return NextResponse.json({ ok: true })
}
