import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { listNotifications, markAllRead, unreadCount } from '@/lib/notifications/store'

// GET /api/notifications — recent notifications + unread count (bell dropdown).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const [notifications, unread] = await Promise.all([
      listNotifications(session.userId),
      unreadCount(session.userId),
    ])
    return NextResponse.json({ notifications, unread })
  } catch (err) {
    console.error('[notifications] read failed:', err)
    return NextResponse.json({ error: 'Could not load notifications.' }, { status: 500 })
  }
}

// PATCH /api/notifications — mark everything read (fired when the bell opens).
export async function PATCH() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    await markAllRead(session.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications] mark read failed:', err)
    return NextResponse.json({ error: 'Could not update notifications.' }, { status: 500 })
  }
}
