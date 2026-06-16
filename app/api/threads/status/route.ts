import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount } from '@/lib/threads/store'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const account = await getAccount(session.userId)
  if (!account) return NextResponse.json({ connected: false })
  return NextResponse.json({ connected: true, username: account.username, scope: account.scope })
}
