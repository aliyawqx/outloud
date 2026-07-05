import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { refund } from '@/lib/credits'
import { releaseSlotForManual } from '@/lib/schedule/conflict'
import { parseMedia, parsePlatforms } from '@/lib/schedule/parse'
import { isValidTimeZone } from '@/lib/schedule/slots'
import { cancelScheduledPost, getScheduledPost, updateScheduledPost, type ScheduledPostPatch } from '@/lib/schedule/store'

type Ctx = { params: Promise<{ id: string }> }
const TEXT_MAX = 25000

// PATCH /api/scheduled-posts/[id] — edit a draft/scheduled post before it fires.
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>

  const patch: ScheduledPostPatch = {}
  if (typeof b.content === 'string') {
    const content = b.content.trim()
    if (!content) return NextResponse.json({ error: 'Post text cannot be empty.' }, { status: 400 })
    if (content.length > TEXT_MAX) return NextResponse.json({ error: 'That post is too long.' }, { status: 400 })
    patch.content = content
  }
  if (b.firstReply !== undefined) {
    patch.firstReply = typeof b.firstReply === 'string' && b.firstReply.trim() ? b.firstReply.trim().slice(0, TEXT_MAX) : null
  }
  if (b.platforms !== undefined) {
    const platforms = parsePlatforms(b.platforms)
    if (!platforms) return NextResponse.json({ error: 'Pick at least one platform.' }, { status: 400 })
    patch.platforms = platforms
  }
  if (b.media !== undefined) patch.media = parseMedia(b.media)
  if (b.scheduledFor !== undefined) {
    const when = typeof b.scheduledFor === 'string' ? new Date(b.scheduledFor) : null
    if (!when || Number.isNaN(when.getTime())) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
    if (when.getTime() <= Date.now()) return NextResponse.json({ error: 'Pick a time in the future.' }, { status: 400 })
    patch.scheduledFor = when
  }
  if (b.timezone !== undefined) {
    if (typeof b.timezone !== 'string' || !isValidTimeZone(b.timezone)) {
      return NextResponse.json({ error: 'Invalid timezone.' }, { status: 400 })
    }
    patch.timezone = b.timezone
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  try {
    // Moving a MANUAL post into a new slot also wins over pending autopilot there.
    if (patch.scheduledFor) {
      const existing = await getScheduledPost(session.userId, id)
      if (existing?.source === 'manual') await releaseSlotForManual(session.userId, patch.scheduledFor)
    }
    const post = await updateScheduledPost(session.userId, id, patch)
    if (!post) {
      const existing = await getScheduledPost(session.userId, id)
      if (!existing) return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
      return NextResponse.json({ error: 'This post is already publishing and can no longer be edited.' }, { status: 409 })
    }
    return NextResponse.json({ post })
  } catch (err) {
    console.error('[scheduled-posts] update failed:', err)
    return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 })
  }
}

// DELETE /api/scheduled-posts/[id] — cancel (soft), refunding an unpublished
// autopilot charge. Never hard-deletes.
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  try {
    const post = await cancelScheduledPost(session.userId, id)
    if (!post) {
      const existing = await getScheduledPost(session.userId, id)
      if (!existing) return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
      return NextResponse.json({ error: 'This post is already publishing and can no longer be cancelled.' }, { status: 409 })
    }
    if (post.chargeLedgerId && post.creditsCharged > 0 && !post.publishedAt) {
      await refund(session.userId, post.chargeLedgerId).catch((e) => console.error('[scheduled-posts] refund failed:', e))
    }
    return NextResponse.json({ post })
  } catch (err) {
    console.error('[scheduled-posts] cancel failed:', err)
    return NextResponse.json({ error: 'Could not cancel that. Try again.' }, { status: 500 })
  }
}
