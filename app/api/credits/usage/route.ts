import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getUsage, getLedger, resetIfDue } from '@/lib/credits'

// GET /api/credits/usage — balance, plan allowance, this cycle's spend, the daily
// graph, AND a per-entry ledger (transparency + debugging). Runs the lazy
// free-allowance reset first so the numbers reflect the current cycle.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  await resetIfDue(session.userId)
  const [usage, ledger] = await Promise.all([getUsage(session.userId), getLedger(session.userId, 50)])
  return NextResponse.json({ ...usage, ledger })
}
