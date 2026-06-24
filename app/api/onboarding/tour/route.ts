import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { setTourDone, resetTours } from '@/lib/profile/store'

// POST /api/onboarding/tour — persist onboarding tour state on the user's profile.
//   { tour: "welcome", done?: true }   → mark a tour complete (or incomplete)
//   { reset: ["welcome","new_post"] }  → clear those tours so they replay
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as { tour?: unknown; done?: unknown; reset?: unknown }

  if (Array.isArray(b.reset)) {
    const tours = b.reset.filter((t): t is string => typeof t === 'string')
    await resetTours(session.userId, tours)
    return NextResponse.json({ ok: true })
  }

  if (typeof b.tour === 'string' && b.tour) {
    await setTourDone(session.userId, b.tour, b.done !== false)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
}
