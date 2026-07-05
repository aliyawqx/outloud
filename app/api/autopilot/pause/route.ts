import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAutopilotSettings, pauseAutopilot } from '@/lib/autopilot/store'

// POST /api/autopilot/pause — user-initiated pause.
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    await pauseAutopilot(session.userId, 'user')
    return NextResponse.json({ settings: await getAutopilotSettings(session.userId) })
  } catch (err) {
    console.error('[autopilot] pause failed:', err)
    return NextResponse.json({ error: 'Could not pause autopilot.' }, { status: 500 })
  }
}
