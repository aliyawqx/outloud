import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount } from '@/lib/linkedin/store'

// GET /api/linkedin/status — connection state incl. reconnect/expiry info for
// the proactive nudge (spec §5).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const account = await getAccount(session.userId)
  if (!account) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    name: account.displayName,
    status: account.status,
    expiresAt: account.expiresAt.toISOString(),
    hasRefreshToken: account.hasRefreshToken,
  })
}
