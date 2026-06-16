import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount, getValidAccessToken } from '@/lib/threads/store'
import { searchThreadsPosts } from '@/lib/threads/search'
import { keywordSearchEnabled, THREADS_KEYWORD_SEARCH_SCOPE } from '@/lib/threads/oauth'
import { listProfiles } from '@/lib/voice/store'
import { isVoiceReady } from '@/lib/voice/ready'
import {
  ThreadsAuthError,
  ThreadsNotConnectedError,
  ThreadsSearchRateLimitError,
  ThreadsSearchUnavailableError,
} from '@/lib/threads/errors'

export const maxDuration = 60

// POST /api/reply/threads-search — discover recent Threads posts on a topic via
// keyword_search (the Threads twin of /api/reply/search). No reach judge: the
// endpoint exposes no engagement/follower signals, so we surface posts as-is.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const topic = typeof (body as { topic?: unknown }).topic === 'string' ? (body as { topic: string }).topic.trim() : ''
  if (!topic) return NextResponse.json({ error: 'Tell us a topic to look for.' }, { status: 400 })
  const author = typeof (body as { author?: unknown }).author === 'string' ? (body as { author: string }).author.trim() : ''

  // A ready voice is still required — the reply generation that follows needs it.
  const voice = (await listProfiles(session.userId)).find(isVoiceReady)
  if (!voice) return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })

  // keyword_search needs the threads_keyword_search permission. It's only requested
  // (and granted) once the operator opts in AND the account reconnected since then.
  if (!keywordSearchEnabled()) {
    return NextResponse.json(
      { error: "Topic search on Threads isn't enabled yet.", searchUnavailable: true },
      { status: 409 },
    )
  }

  let token: string
  let account
  try {
    token = await getValidAccessToken(session.userId)
    account = await getAccount(session.userId)
  } catch (err) {
    if (err instanceof ThreadsNotConnectedError)
      return NextResponse.json({ error: 'Connect your Threads account to discover posts.', needsThreads: true }, { status: 409 })
    if (err instanceof ThreadsAuthError)
      return NextResponse.json({ error: 'Your Threads connection expired. Reconnect your Threads account.', needsReconnect: true }, { status: 409 })
    throw err
  }

  if (!account?.scope.split(',').includes(THREADS_KEYWORD_SEARCH_SCOPE)) {
    return NextResponse.json(
      { error: 'Reconnect your Threads account to enable topic search.', needsReconnect: true },
      { status: 409 },
    )
  }

  try {
    const posts = await searchThreadsPosts(token, topic, { authorUsername: author || undefined })
    // Same envelope as the X branch so the UI renders both feeds the same way.
    const results = posts.map((p) => ({
      id: p.id,
      text: p.text,
      username: p.username,
      permalink: p.permalink,
      timestamp: p.timestamp,
      hasReplies: p.hasReplies,
    }))
    return NextResponse.json({ results, topic })
  } catch (err) {
    if (err instanceof ThreadsSearchRateLimitError)
      return NextResponse.json({ error: err.message, rateLimited: true }, { status: 429 })
    if (err instanceof ThreadsSearchUnavailableError)
      return NextResponse.json({ error: err.message, searchUnavailable: true }, { status: 409 })
    console.error('[reply/threads-search] failed:', err)
    return NextResponse.json({ error: "Couldn't search Threads right now. Try again." }, { status: 502 })
  }
}
