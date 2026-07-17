import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getComposeEntry, updateComposeChat } from '@/lib/voice/history'
import type { PublishedMap } from '@/lib/voice/types'

const PLATFORMS = ['x', 'threads', 'linkedin'] as const

// POST /api/voice/history/published — persist where the Nth draft of a saved chat has
// been published (platform → {url, at}), so reopened chats show publish state and offer
// republish. Mirrors /api/voice/history/image: set `published` on the matching draft in
// both `messages` and `drafts` and re-save the entry.
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
  if (!historyId || draftIndex < 0) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  // Validate the map: known platforms only, each entry needs a valid url.
  const raw = (b.published ?? {}) as Record<string, unknown>
  const published: PublishedMap = {}
  for (const key of PLATFORMS) {
    const r = (raw[key] ?? null) as { url?: unknown; at?: unknown } | null
    if (!r) continue
    const url = typeof r.url === 'string' ? r.url : ''
    if (!/^https?:\/\//.test(url)) continue
    const at = typeof r.at === 'string' ? r.at : new Date().toISOString()
    published[key] = { url, at }
  }
  const fields = { published }

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
        return { ...t, draft: { ...t.draft, ...fields } }
      }
      n++
    }
    return t
  })
  // Keep the flat drafts[] array in sync (same order as the draft turns).
  const drafts = entry.drafts.map((d, i) => (i === draftIndex ? { ...d, ...fields } : d))

  if (!found) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 })
  await updateComposeChat(session.userId, historyId, { drafts, messages })
  return NextResponse.json({ ok: true })
}
