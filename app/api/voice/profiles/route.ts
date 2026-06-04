import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { validateCreateProfile } from '@/lib/voice/validateProfile'
import { buildInspiration, buildOwn, UnknownSourceError } from '@/lib/voice/build'
import { createProfile, listProfiles } from '@/lib/voice/store'

// GET /api/voice/profiles — list the signed-in user's saved profiles.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const ownerKey = session.userId

  try {
    const profiles = await listProfiles(ownerKey)
    return NextResponse.json({ profiles })
  } catch {
    return NextResponse.json({ error: 'Could not load your voices.' }, { status: 500 })
  }
}

// POST /api/voice/profiles — save a new profile (own or inspiration blend).
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const ownerKey = session.userId

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateCreateProfile(body)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const { name, kind, sources, isActive } = result.value

  try {
    const blended =
      kind === 'own'
        ? { sources: [], ...buildOwn() }
        : buildInspiration(sources)

    const profile = await createProfile({
      ownerKey,
      kind,
      name,
      sources: blended.sources,
      mergedTags: blended.mergedTags,
      styleSummary: blended.styleSummary,
      isActive,
    })
    return NextResponse.json({ profile }, { status: 201 })
  } catch (err) {
    if (err instanceof UnknownSourceError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not save your voice.' }, { status: 500 })
  }
}
