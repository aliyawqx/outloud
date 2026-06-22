import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getComposeEntry, updateComposeChat } from '@/lib/voice/history'

// POST /api/voice/history/text — persist an edited draft's text to a saved chat, so
// the edit survives a page reload. The draft lives in the chat's JSONB transcript; we
// set `fullText` on the matching draft in both `messages` and `drafts` and re-save.
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
  const historyId = typeof b.historyId === 'string' ? b.historyId : ''
  const draftIndex = typeof b.draftIndex === 'number' ? b.draftIndex : -1
  const fullText = typeof b.fullText === 'string' ? b.fullText : null
  if (!historyId || draftIndex < 0 || fullText === null) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const entry = await getComposeEntry(session.userId, historyId)
  if (!entry) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  // Apply to the Nth draft within the transcript (draft turns are in render order).
  let n = 0
  let found = false
  const messages = entry.messages.map((t) => {
    if (t && typeof t === 'object' && 'draft' in t && t.draft) {
      if (n === draftIndex) {
        found = true
        n++
        return { ...t, draft: { ...t.draft, fullText } }
      }
      n++
    }
    return t
  })
  // Keep the flat drafts[] array in sync (same order as the draft turns).
  const drafts = entry.drafts.map((d, i) => (i === draftIndex ? { ...d, fullText } : d))

  if (!found) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 })
  await updateComposeChat(session.userId, historyId, { drafts, messages })
  return NextResponse.json({ ok: true })
}
