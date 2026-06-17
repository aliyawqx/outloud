import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getUsage, resetIfDue } from '@/lib/credits'

// GET /api/credits/usage — balance, plan allowance, this month's spend, and the
// last 7 days of daily spend. Runs the lazy free-allowance reset first so the
// numbers reflect the current cycle.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  await resetIfDue(session.userId)
  const usage = await getUsage(session.userId)
  return NextResponse.json(usage)
}
