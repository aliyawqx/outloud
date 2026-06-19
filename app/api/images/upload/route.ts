import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { storeImage, blobConfigured } from '@/lib/images/blob'

export const maxDuration = 30

const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp'])

// POST /api/images/upload — store the user's own image file in Vercel Blob and
// return its public URL. Free (no credit cost).
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!blobConfigured()) return NextResponse.json({ error: 'Image storage isn’t set up yet.' }, { status: 503 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Use a PNG, JPEG, or WebP image.' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 5MB or smaller.' }, { status: 413 })
  }

  try {
    const url = await storeImage(await file.arrayBuffer(), file.type)
    return NextResponse.json({ url, source: 'upload' })
  } catch (err) {
    console.error('[images/upload] failed:', err)
    return NextResponse.json({ error: "Couldn't save that image. Try again." }, { status: 502 })
  }
}
