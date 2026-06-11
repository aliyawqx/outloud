import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount, getValidAccessToken } from '@/lib/x/store'
import { postTweet } from '@/lib/x/client'
import { PostTooLongError, PublishError, ReplyNotAllowedError, XAuthError, XNotConnectedError } from '@/lib/x/errors'

const TEXT_MAX = 25000 // X long-post ceiling; account tier enforces the real limit.

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
  if (text.length > TEXT_MAX) return NextResponse.json({ error: 'That post is too long.' }, { status: 400 })
  // Optional: when set, publish as a reply to this tweet (Reply Studio).
  const rawReplyTo = (body as { inReplyTo?: unknown }).inReplyTo
  const inReplyTo = typeof rawReplyTo === 'string' && /^\d{1,25}$/.test(rawReplyTo) ? rawReplyTo : undefined

  try {
    const token = await getValidAccessToken(session.userId)
    const { id } = await postTweet(token, text, inReplyTo)
    const account = await getAccount(session.userId)
    const url = account ? `https://x.com/${account.username}/status/${id}` : `https://x.com/i/web/status/${id}`
    return NextResponse.json({ id, url })
  } catch (err) {
    if (err instanceof XNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof XAuthError)
      return NextResponse.json({ error: 'Your X connection expired. Reconnect your X account.', needsReconnect: true }, { status: 409 })
    if (err instanceof ReplyNotAllowedError) {
      return NextResponse.json({ error: err.message, replyBlocked: true }, { status: 422 })
    }
    if (err instanceof PostTooLongError) {
      return NextResponse.json(
        {
          error: `You don't have X Premium, so X only lets you publish posts up to ${err.limit} characters. This one is ${text.length}. Shorten it to ${err.limit} or fewer, or upgrade your X account.`,
          tooLong: true,
          limit: err.limit,
        },
        { status: 422 },
      )
    }
    if (err instanceof PublishError) {
      // X's raw reason (e.g. billing/credits, rate limit) is internal — log it,
      // show the customer a clean, generic message.
      console.error('[x/publish] X rejected the post:', err.message)
      return NextResponse.json({ error: "Couldn't publish to X right now. Please try again." }, { status: 502 })
    }
    console.error('[x/publish] failed:', err)
    return NextResponse.json({ error: 'Could not publish to X. Try again.' }, { status: 500 })
  }
}
