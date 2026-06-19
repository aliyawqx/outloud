import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount, getValidAccessToken } from '@/lib/threads/store'
import { getPermalink, publishThread, THREADS_TEXT_LIMIT } from '@/lib/threads/client'
import {
  ThreadsAuthError,
  ThreadsNotConnectedError,
  ThreadsPostTooLongError,
  ThreadsPublishError,
  ThreadsRateLimitError,
} from '@/lib/threads/errors'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : ''
  if (!text) return NextResponse.json({ error: 'Nothing to publish.' }, { status: 400 })
  // Validate the 500-char limit up front so we never burn a container creation.
  if (text.length > THREADS_TEXT_LIMIT) {
    return NextResponse.json(
      {
        error: `Threads posts are limited to ${THREADS_TEXT_LIMIT} characters. This one is ${text.length}. Shorten it to ${THREADS_TEXT_LIMIT} or fewer.`,
        tooLong: true,
        limit: THREADS_TEXT_LIMIT,
      },
      { status: 422 },
    )
  }
  // Optional: when set, publish as a reply to this Threads post.
  const rawReplyTo = (body as { inReplyTo?: unknown }).inReplyTo
  const inReplyTo = typeof rawReplyTo === 'string' && /^\d{1,30}$/.test(rawReplyTo) ? rawReplyTo : undefined
  // Optional attached image — must be a public URL (our Blob URL) Threads can fetch.
  const imageUrl = typeof (body as { imageUrl?: unknown }).imageUrl === 'string' ? (body as { imageUrl: string }).imageUrl : undefined

  try {
    const token = await getValidAccessToken(session.userId)
    const account = await getAccount(session.userId)
    if (!account) throw new ThreadsNotConnectedError()
    const { id } = await publishThread(token, account.threadsUserId, text, { replyToId: inReplyTo, imageUrl })
    const permalink = await getPermalink(token, id)
    const url = permalink ?? `https://www.threads.net/@${account.username}`
    return NextResponse.json({ id, url })
  } catch (err) {
    if (err instanceof ThreadsNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof ThreadsAuthError)
      return NextResponse.json(
        { error: 'Your Threads connection expired. Reconnect your Threads account.', needsReconnect: true },
        { status: 409 },
      )
    if (err instanceof ThreadsPostTooLongError) {
      return NextResponse.json({ error: err.message, tooLong: true, limit: err.limit }, { status: 422 })
    }
    if (err instanceof ThreadsRateLimitError) {
      return NextResponse.json({ error: err.message, rateLimited: true }, { status: 429 })
    }
    if (err instanceof ThreadsPublishError) {
      console.error('[threads/publish] Threads rejected the post:', err.message)
      return NextResponse.json({ error: "Couldn't publish to Threads right now. Please try again." }, { status: 502 })
    }
    console.error('[threads/publish] failed:', err)
    return NextResponse.json({ error: 'Could not publish to Threads. Try again.' }, { status: 500 })
  }
}
