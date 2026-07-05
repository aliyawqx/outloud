import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAutopilotSettings, resumeAutopilot } from '@/lib/autopilot/store'

// POST /api/autopilot/resume — clears any pause (user or insufficient_credits).
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    await resumeAutopilot(session.userId)
    return NextResponse.json({ settings: await getAutopilotSettings(session.userId) })
  } catch (err) {
    console.error('[autopilot] resume failed:', err)
    return NextResponse.json({ error: 'Could not resume autopilot.' }, { status: 500 })
  }
}
