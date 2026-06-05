import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/voice/store'
import { addSamples } from '@/lib/voice/samples'
import { getAccount, getValidAccessToken } from '@/lib/x/store'
import { fetchOriginalTweets } from '@/lib/x/client'
import { ImportNotAvailableError, XNotConnectedError } from '@/lib/x/errors'

const IMPORT_COUNT = 20

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

  const profile = await getProfile(session.userId, profileId)
  if (!profile) return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })

  const account = await getAccount(session.userId)
  if (!account) return NextResponse.json({ error: 'Connect your X account first.' }, { status: 409 })

  try {
    const token = await getValidAccessToken(session.userId)
    const texts = await fetchOriginalTweets(token, account.xUserId, IMPORT_COUNT)
    if (!texts.length) return NextResponse.json({ error: 'No original posts found to import.' }, { status: 400 })
    const created = await addSamples(
      session.userId,
      profileId,
      texts.map((text) => ({ source: 'x' as const, text })),
    )
    return NextResponse.json({ added: created.length, samples: created })
  } catch (err) {
    if (err instanceof ImportNotAvailableError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof XNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    console.error('[x/import] failed:', err)
    return NextResponse.json({ error: 'Could not import your posts. Try again.' }, { status: 500 })
  }
}
