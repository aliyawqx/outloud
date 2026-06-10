import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { fetchPost } from '@/lib/x/fetchPost'
import { InvalidPostUrlError, PostUnavailableError } from '@/lib/x/errors'

// POST /api/reply/fetch — resolve a pasted X post URL to its text + author (Mode A).
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const url = (body as { url?: unknown }).url
  if (typeof url !== 'string' || !url.trim()) {
    return NextResponse.json({ error: 'Paste an X post link.' }, { status: 400 })
  }

  try {
    const post = await fetchPost(url)
    return NextResponse.json({ post })
  } catch (err) {
    if (err instanceof InvalidPostUrlError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof PostUnavailableError) return NextResponse.json({ error: err.message }, { status: 404 })
    console.error('[reply/fetch] failed:', err)
    return NextResponse.json({ error: "Couldn't read that post. Try again." }, { status: 502 })
  }
}
