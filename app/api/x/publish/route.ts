import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount, getValidAccessToken } from '@/lib/x/store'
import { postTweet } from '@/lib/x/client'
import { PublishError, XNotConnectedError } from '@/lib/x/errors'

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

  try {
    const token = await getValidAccessToken(session.userId)
    const { id } = await postTweet(token, text)
    const account = await getAccount(session.userId)
    const url = account ? `https://x.com/${account.username}/status/${id}` : `https://x.com/i/web/status/${id}`
    return NextResponse.json({ id, url })
  } catch (err) {
    if (err instanceof XNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof PublishError) return NextResponse.json({ error: err.message }, { status: 502 })
    console.error('[x/publish] failed:', err)
    return NextResponse.json({ error: 'Could not publish to X. Try again.' }, { status: 500 })
  }
}
