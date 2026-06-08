import { NextResponse } from 'next/server'
import { getSession, clearSessionCookie } from '@/lib/auth/session'
import { deleteAccount } from '@/lib/auth/users'

// DELETE /api/account — permanently delete the signed-in user and all their data.
export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  try {
    await deleteAccount(session.userId)
  } catch (err) {
    console.error('[account] delete failed:', err)
    return NextResponse.json({ error: "Couldn't delete your account. Try again." }, { status: 500 })
  }

  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
