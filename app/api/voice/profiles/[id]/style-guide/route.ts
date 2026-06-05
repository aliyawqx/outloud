import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, setStyleGuide } from '@/lib/voice/store'
import { listEnabledTexts } from '@/lib/voice/samples'
import { generateStyleGuide } from '@/lib/anthropic'

type Ctx = { params: Promise<{ id: string }> }
const GUIDE_MAX = 20_000

// POST /api/voice/profiles/:id/style-guide — (re)generate the guide from enabled samples.
export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  const profile = await getProfile(session.userId, id)
  if (!profile) return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })

  const samples = await listEnabledTexts(session.userId, id)
  if (samples.length === 0) {
    return NextResponse.json({ error: 'Add at least one sample marked "used in style" first.' }, { status: 400 })
  }

  try {
    const guide = await generateStyleGuide(samples)
    const updated = await setStyleGuide(session.userId, id, guide)
    return NextResponse.json({ profile: updated })
  } catch (err) {
    console.error('[style-guide] generate failed:', err)
    return NextResponse.json({ error: 'Could not generate the Style Guide. Try again.' }, { status: 500 })
  }
}

// PATCH /api/voice/profiles/:id/style-guide — save an edited guide.
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  const profile = await getProfile(session.userId, id)
  if (!profile) return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>
  const guideMarkdown = typeof b.guideMarkdown === 'string' ? b.guideMarkdown.trim() : ''
  if (!guideMarkdown) return NextResponse.json({ error: 'Guide cannot be empty.' }, { status: 400 })
  if (guideMarkdown.length > GUIDE_MAX) return NextResponse.json({ error: 'Guide is too long.' }, { status: 400 })
  const summary =
    typeof b.summary === 'string' && b.summary.trim() ? b.summary.trim() : profile.styleSummary

  const updated = await setStyleGuide(session.userId, id, { guideMarkdown, summary })
  return NextResponse.json({ profile: updated })
}
