import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/voice/store'
import { addSamples, listSamples } from '@/lib/voice/samples'
import { validateAddSample } from '@/lib/voice/validateSample'
import { fetchSampleFromUrl, UrlFetchError } from '@/lib/voice/fetchUrl'

type Ctx = { params: Promise<{ id: string }> }

async function requireOwnedProfile(userId: string, id: string) {
  return getProfile(userId, id)
}

// GET /api/voice/profiles/:id/samples
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  if (!(await requireOwnedProfile(session.userId, id))) {
    return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })
  }
  return NextResponse.json({ samples: await listSamples(session.userId, id) })
}

// POST /api/voice/profiles/:id/samples — add one sample (paste/upload/url).
export async function POST(req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  if (!(await requireOwnedProfile(session.userId, id))) {
    return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateAddSample(body)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  try {
    let text: string
    if (result.value.source === 'url') {
      text = await fetchSampleFromUrl(result.value.url)
    } else {
      text = result.value.text
    }
    const [sample] = await addSamples(session.userId, id, [{ source: result.value.source, text }])
    return NextResponse.json({ sample }, { status: 201 })
  } catch (err) {
    if (err instanceof UrlFetchError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[samples] add failed:', err)
    return NextResponse.json({ error: 'Could not add that sample.' }, { status: 500 })
  }
}
