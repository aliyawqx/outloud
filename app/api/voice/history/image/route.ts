import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getComposeEntry, updateComposeChat } from '@/lib/voice/history'
import type { DraftImage } from '@/lib/voice/types'

// POST /api/voice/history/image — persist the images attached to the Nth draft of a
// saved chat, so they survive a page reload. The draft lives inside the chat's JSONB
// transcript; we set `images` on the matching draft in both `messages` and `drafts`
// and re-save the entry. Legacy single-image fields are cleared.
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

  // Validate the images array (cap 4); each must have a valid url.
  const rawImages = Array.isArray(b.images) ? b.images : []
  const images: DraftImage[] = []
  for (const raw of rawImages.slice(0, 4)) {
    const r = (raw ?? {}) as { url?: unknown; source?: unknown; alt?: unknown }
    const url = typeof r.url === 'string' ? r.url : ''
    if (!/^https?:\/\//.test(url)) continue
    const source = r.source === 'ai' || r.source === 'stock' || r.source === 'upload' ? r.source : 'upload'
    images.push({ url, source, alt: typeof r.alt === 'string' ? r.alt : undefined })
  }
  // Set the new array; drop the legacy single-image fields.
  const fields = { images, imageUrl: undefined, imageSource: undefined, imageAlt: undefined }

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
