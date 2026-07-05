import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { deleteAccount } from '@/lib/linkedin/store'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  await deleteAccount(session.userId)
  return NextResponse.json({ connected: false })
}
