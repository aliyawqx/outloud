import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { getSession } from '@/lib/auth/session'
import { isStaff } from '@/lib/appLock'
import { deduct, getBalance, resetIfDue, COST_PER_AI_PHOTO } from '@/lib/credits'
import { storeImageFromUrl } from '@/lib/images/blob'

export const maxDuration = 60

const PROMPT_MAX = 1500

// POST /api/images/generate — generate an image with fal.ai Flux (schnell) and store
// it in Blob. Per spec: pre-CHECK the balance (don't deduct), generate, and only
// deduct COST_PER_AI_PHOTO after a successful generation — so a failed render is free.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!process.env.FAL_KEY) return NextResponse.json({ error: 'AI images are not available.' }, { status: 503 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const prompt = typeof (body as { prompt?: unknown })?.prompt === 'string' ? (body as { prompt: string }).prompt.trim().slice(0, PROMPT_MAX) : ''
  if (!prompt) return NextResponse.json({ error: 'Describe the image first.' }, { status: 400 })

  // Pre-check only — never run a (billable) generation for someone who can't afford it.
  const staff = isStaff(session.email)
  if (!staff) {
    await resetIfDue(session.userId)
    const balance = await getBalance(session.userId)
    if (balance < COST_PER_AI_PHOTO) {
      return NextResponse.json(
        { error: 'Not enough credits.', insufficientCredits: true, cost: COST_PER_AI_PHOTO, balance },
        { status: 402 },
      )
    }
  }

  let imageUrl: string
  try {
    fal.config({ credentials: process.env.FAL_KEY })
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: { prompt, image_size: 'square_hd', num_images: 1 },
    })
    const out = (result.data as { images?: Array<{ url?: string }> })?.images?.[0]?.url
    if (!out) throw new Error('no image returned')
    // Copy off fal's temporary URL into our own Blob so the link is durable + public.
    imageUrl = (await storeImageFromUrl(out, 'draft-images/ai')).url
  } catch (err) {
    console.error('[images/generate] failed:', err) // generation failed → user not charged
    return NextResponse.json({ error: "Couldn't generate that image. Try again." }, { status: 502 })
  }

  // Success → charge now. If the deduction somehow fails, still return the image we
  // already produced rather than throw away a paid render.
  if (!staff) {
    try {
      await deduct(session.userId, COST_PER_AI_PHOTO, 'ai_image', { metadata: { kind: 'ai' } })
    } catch (err) {
      console.error('[images/generate] charge after success failed:', err)
    }
  }
  const creditsLeft = staff ? undefined : await getBalance(session.userId)
  return NextResponse.json({ url: imageUrl, source: 'ai', creditsLeft })
}
