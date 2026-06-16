import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { threadsConfig } from '@/lib/threads/config'
import { parseSignedRequest } from '@/lib/threads/signedRequest'
import { deleteAccountByThreadsUserId } from '@/lib/threads/store'

// POST /api/threads/delete — Meta's data-deletion callback. Server-to-server,
// authenticated by the signed request. We delete the user's stored Threads data
// and reply with the { url, confirmation_code } shape Meta expects so the user can
// check the deletion status.
export async function POST(req: Request) {
  let signedRequest = ''
  try {
    const form = await req.formData()
    signedRequest = String(form.get('signed_request') || '')
  } catch {
    try {
      signedRequest = new URLSearchParams(await req.text()).get('signed_request') || ''
    } catch {
      signedRequest = ''
    }
  }

  const { clientSecret } = threadsConfig()
  const payload = parseSignedRequest(signedRequest, clientSecret)
  if (!payload?.user_id) return NextResponse.json({ error: 'Invalid signed request.' }, { status: 400 })

  const confirmationCode = randomUUID()
  try {
    await deleteAccountByThreadsUserId(payload.user_id)
  } catch (err) {
    console.error('[threads/delete] cleanup failed:', err)
  }

  // Meta requires this exact response shape; `url` is where the user can confirm
  // the deletion request, `confirmation_code` is our tracking reference.
  return NextResponse.json({
    url: 'https://tryoutloud.app/privacy#data-deletion',
    confirmation_code: confirmationCode,
  })
}
