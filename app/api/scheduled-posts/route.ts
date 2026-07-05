import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { parseMedia, parsePlatforms } from '@/lib/schedule/parse'
import { releaseSlotForManual } from '@/lib/schedule/conflict'
import { isValidTimeZone } from '@/lib/schedule/slots'
import { createScheduledPost, listScheduledPosts } from '@/lib/schedule/store'

const TEXT_MAX = 25000 // matches the X publish route ceiling
const RANGE_MAX_DAYS = 100

// POST /api/scheduled-posts — place a manual post on the calendar. Manual wins:
// a pending autopilot post in the same slot is cancelled (+ refunded) first.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>

  const content = typeof b.content === 'string' ? b.content.trim() : ''
  if (!content) return NextResponse.json({ error: 'Nothing to schedule.' }, { status: 400 })
  if (content.length > TEXT_MAX) return NextResponse.json({ error: 'That post is too long.' }, { status: 400 })

  const platforms = parsePlatforms(b.platforms)
  if (!platforms) return NextResponse.json({ error: 'Pick at least one platform.' }, { status: 400 })

  const scheduledFor = typeof b.scheduledFor === 'string' ? new Date(b.scheduledFor) : null
  if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }
  if (scheduledFor.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Pick a time in the future.' }, { status: 400 })
  }

  const timezone = typeof b.timezone === 'string' ? b.timezone : ''
  if (!isValidTimeZone(timezone)) return NextResponse.json({ error: 'Invalid timezone.' }, { status: 400 })

  const firstReply = typeof b.firstReply === 'string' && b.firstReply.trim() ? b.firstReply.trim().slice(0, TEXT_MAX) : null
  const media = parseMedia(b.media)
  if (media === 'invalid') return NextResponse.json({ error: 'Invalid media.' }, { status: 400 })

  try {
    const evicted = await releaseSlotForManual(session.userId, scheduledFor)
    const post = await createScheduledPost({
      userId: session.userId,
      content,
      firstReply,
      platforms,
      media,
      scheduledFor,
      timezone,
      source: 'manual',
    })
    return NextResponse.json({ post, evicted }, { status: 201 })
  } catch (err) {
    console.error('[scheduled-posts] create failed:', err)
    return NextResponse.json({ error: 'Could not schedule that. Try again.' }, { status: 500 })
  }
}

// GET /api/scheduled-posts?from=&to= — calendar range read.
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const url = new URL(req.url)
  const from = new Date(url.searchParams.get('from') ?? '')
  const to = new Date(url.searchParams.get('to') ?? '')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'Invalid range.' }, { status: 400 })
  }
  if (to.getTime() - from.getTime() > RANGE_MAX_DAYS * 86_400_000) {
    return NextResponse.json({ error: 'Range too large.' }, { status: 400 })
  }

  try {
    const posts = await listScheduledPosts(session.userId, from, to)
    return NextResponse.json({ posts })
  } catch (err) {
    console.error('[scheduled-posts] list failed:', err)
    return NextResponse.json({ error: 'Could not load the calendar. Try again.' }, { status: 500 })
  }
}
