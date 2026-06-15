import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/voice/store'
import { addSamples } from '@/lib/voice/samples'
import { getAccount, getValidAccessToken } from '@/lib/x/store'
import { fetchOriginalTweets } from '@/lib/x/client'
import { fetchTimelineViaWorker } from '@/lib/x/timeline'
import { ImportNotAvailableError, SearchUnavailableError, XAuthError, XNotConnectedError } from '@/lib/x/errors'

const IMPORT_COUNT = 20

// POST /api/x/import — pull the user's recent original posts into a voice. Source
// is X_IMPORT_PROVIDER: 'nitter' = the worker by @handle (no X API, no account
// needed — handle from body, else the connected account), otherwise the official
// X API (needs a connected account + token).
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const profileId = typeof (body as { profileId?: unknown })?.profileId === 'string' ? (body as { profileId: string }).profileId : ''
  if (!profileId) return NextResponse.json({ error: 'No voice selected.' }, { status: 400 })
  const bodyHandle = typeof (body as { handle?: unknown }).handle === 'string' ? (body as { handle: string }).handle.trim().replace(/^@/, '') : ''

  const profile = await getProfile(session.userId, profileId)
  if (!profile) return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })

  const provider = (process.env.X_IMPORT_PROVIDER || '').toLowerCase()

  try {
    let texts: string[]
    if (provider === 'nitter') {
      // No X account required — just a public @handle (body, else the connected one).
      const account = await getAccount(session.userId)
      const handle = bodyHandle || account?.username || ''
      if (!handle) return NextResponse.json({ error: 'Enter your @handle to import.', needsHandle: true }, { status: 400 })
      texts = await fetchTimelineViaWorker(handle, IMPORT_COUNT)
    } else {
      const account = await getAccount(session.userId)
      if (!account) return NextResponse.json({ error: 'Connect your X account first.' }, { status: 409 })
      const token = await getValidAccessToken(session.userId)
      texts = await fetchOriginalTweets(token, account.xUserId, IMPORT_COUNT)
    }

    if (!texts.length) return NextResponse.json({ error: 'No original posts found to import.' }, { status: 400 })
    const created = await addSamples(
      session.userId,
      profileId,
      texts.map((text) => ({ source: 'x' as const, text })),
    )
    return NextResponse.json({ added: created.length, samples: created })
  } catch (err) {
    if (err instanceof SearchUnavailableError)
      return NextResponse.json({ error: "Couldn't reach the import service right now. Try again, or connect X.", importUnavailable: true }, { status: 409 })
    if (err instanceof ImportNotAvailableError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof XNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof XAuthError)
      return NextResponse.json({ error: 'Your X connection expired. Reconnect your X account.', needsReconnect: true }, { status: 409 })
    console.error('[x/import] failed:', err)
    return NextResponse.json({ error: 'Could not import your posts. Try again.' }, { status: 500 })
  }
}
