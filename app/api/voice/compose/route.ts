import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, listProfiles } from '@/lib/voice/store'
import { generatePost, NotImplementedError } from '@/lib/voice/generate'

const IDEA_MAX = 2000

// POST /api/voice/compose — Phase: calls the generatePost stub and returns a
// clearly-labeled placeholder draft. No model is invoked yet.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const idea = typeof (body as { idea?: unknown }).idea === 'string' ? (body as { idea: string }).idea.trim() : ''
  if (!idea) return NextResponse.json({ error: 'Tell me what you shipped.' }, { status: 400 })
  if (idea.length > IDEA_MAX) return NextResponse.json({ error: 'Keep your idea shorter.' }, { status: 400 })

  const profileId = (body as { profileId?: unknown }).profileId
  const profile =
    typeof profileId === 'string' && profileId
      ? await getProfile(session.userId, profileId)
      : (await listProfiles(session.userId)).find((p) => p.isActive) ?? null

  const voiceName = profile?.name ?? 'your voice'

  // Drive through the real seam; it throws NotImplemented for now, which we turn
  // into a labeled placeholder. (Generation lands in a later task.)
  try {
    if (profile) {
      const draft = await generatePost({ idea, voiceProfile: profile })
      return NextResponse.json({ draft, voiceName })
    }
  } catch (err) {
    if (!(err instanceof NotImplementedError)) {
      console.error('[compose] failed:', err)
      return NextResponse.json({ error: "Couldn't start writing. Try again." }, { status: 500 })
    }
  }

  const fullText =
    `Sample preview — not generated yet.\n\n` +
    `When live, Outloud will turn this into a full post in ${voiceName}:\n\n` +
    `“${idea}”`
  return NextResponse.json({ placeholder: true, voiceName, draft: { hook: '', story: '', offer: '', fullText } })
}
