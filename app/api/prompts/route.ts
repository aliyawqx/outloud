import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { CommandTakenError, createPrompt, listPrompts, normalizeCommand } from '@/lib/prompts/store'

// GET /api/prompts — the user's format-prompt library (seeded on first read).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  return NextResponse.json({ prompts: await listPrompts(session.userId) })
}

// POST /api/prompts — create a custom command.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>
  const command = normalizeCommand(typeof b.command === 'string' ? b.command : '')
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  const text = typeof b.text === 'string' ? b.text.trim() : ''
  if (!command) return NextResponse.json({ error: 'Add a command name (letters, numbers, dashes).' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'Add a title.' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'Add the prompt text.' }, { status: 400 })

  try {
    const prompt = await createPrompt(session.userId, { command, title, text })
    return NextResponse.json({ prompt }, { status: 201 })
  } catch (err) {
    if (err instanceof CommandTakenError) return NextResponse.json({ error: err.message }, { status: 409 })
    console.error('[prompts] create failed:', err)
    return NextResponse.json({ error: 'Could not save that prompt. Try again.' }, { status: 500 })
  }
}
