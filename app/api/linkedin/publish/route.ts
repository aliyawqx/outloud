import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { LINKEDIN_TEXT_LIMIT, publishLinkedInPost } from '@/lib/linkedin/client'
import {
  LinkedInAuthError,
  LinkedInNotConnectedError,
  LinkedInPostTooLongError,
  LinkedInPublishError,
  LinkedInRateLimitError,
  LinkedInVersionError,
} from '@/lib/linkedin/errors'
import { getAccount, getValidAccessToken, markNeedsReconnect } from '@/lib/linkedin/store'

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
  if (text.length > LINKEDIN_TEXT_LIMIT) {
    return NextResponse.json(
      {
        error: `LinkedIn posts are limited to ${LINKEDIN_TEXT_LIMIT} characters. This one is ${text.length}.`,
        tooLong: true,
        limit: LINKEDIN_TEXT_LIMIT,
      },
      { status: 422 },
    )
  }
  const imageUrls = Array.isArray((body as { imageUrls?: unknown }).imageUrls)
    ? (body as { imageUrls: unknown[] }).imageUrls.filter((u): u is string => typeof u === 'string')
    : []
  const imageAlts = Array.isArray((body as { imageAlts?: unknown }).imageAlts)
    ? (body as { imageAlts: unknown[] }).imageAlts.filter((a): a is string => typeof a === 'string')
    : []

  try {
    const token = await getValidAccessToken(session.userId)
    const account = await getAccount(session.userId)
    if (!account) throw new LinkedInNotConnectedError()
    const { id, imageSkipped } = await publishLinkedInPost(token, account.personUrn, text, { imageUrls, imageAlts })
    // No stable public permalink from the API on this tier — link to the feed.
    return NextResponse.json({ id, url: 'https://www.linkedin.com/feed/', imageSkipped })
  } catch (err) {
    if (err instanceof LinkedInNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof LinkedInAuthError) {
      await markNeedsReconnect(session.userId).catch(() => {})
      return NextResponse.json(
        { error: 'Your LinkedIn connection expired. Reconnect your LinkedIn account.', needsReconnect: true },
        { status: 409 },
      )
    }
    if (err instanceof LinkedInPostTooLongError) {
      return NextResponse.json({ error: err.message, tooLong: true, limit: err.limit }, { status: 422 })
    }
    if (err instanceof LinkedInRateLimitError) {
      return NextResponse.json({ error: 'LinkedIn rate limit reached. Try again later.', rateLimited: true }, { status: 429 })
    }
    if (err instanceof LinkedInVersionError) {
      console.error('[linkedin/publish] version rejected — bump LINKEDIN_API_VERSION')
      return NextResponse.json({ error: "Couldn't publish to LinkedIn right now. Please try again." }, { status: 502 })
    }
    if (err instanceof LinkedInPublishError) {
      console.error('[linkedin/publish] LinkedIn rejected the post:', err.message)
      return NextResponse.json({ error: "Couldn't publish to LinkedIn right now. Please try again." }, { status: 502 })
    }
    console.error('[linkedin/publish] failed:', err)
    return NextResponse.json({ error: 'Could not publish to LinkedIn. Try again.' }, { status: 500 })
  }
}
