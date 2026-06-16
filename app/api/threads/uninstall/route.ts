import { NextResponse } from 'next/server'
import { threadsConfig } from '@/lib/threads/config'
import { parseSignedRequest } from '@/lib/threads/signedRequest'
import { deleteAccountByThreadsUserId } from '@/lib/threads/store'

// POST /api/threads/uninstall — Meta calls this when a user removes the app from
// their Threads account. It's a server-to-server call authenticated by the signed
// request (not a session), so we verify the signature, then drop the stored token.
export async function POST(req: Request) {
  let signedRequest = ''
  try {
    const form = await req.formData()
    signedRequest = String(form.get('signed_request') || '')
  } catch {
    // Fall back to a urlencoded body if formData parsing isn't available.
    try {
      signedRequest = new URLSearchParams(await req.text()).get('signed_request') || ''
    } catch {
      signedRequest = ''
    }
  }

  const { clientSecret } = threadsConfig()
  const payload = parseSignedRequest(signedRequest, clientSecret)
  if (!payload?.user_id) return NextResponse.json({ error: 'Invalid signed request.' }, { status: 400 })

  try {
    await deleteAccountByThreadsUserId(payload.user_id)
  } catch (err) {
    console.error('[threads/uninstall] cleanup failed:', err)
  }
  return NextResponse.json({ ok: true })
}
