import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { isStaff } from '@/lib/appLock'
import { deduct, refund, getBalance, resetIfDue, InsufficientCreditsError, COST_PER_REPLY } from '@/lib/credits'
import { generateReplyVariants } from '@/lib/reply/generate'
import { VoiceNotReadyError } from '@/lib/voice/generate'
import { ModelBusyError } from '@/lib/anthropic'

export const maxDuration = 60

const TEXT_MAX = 4000

// POST /api/reply/generate — 2–3 reply variants in the user's voice for one post
// (shared by Mode A and Mode B). Returns the post id so the UI can build the
// "Reply on X" web-intent link from the (possibly edited) text.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>
  const post = (b.post ?? {}) as Record<string, unknown>
  const tweetId = typeof post.id === 'string' ? post.id : ''
  const text = typeof post.text === 'string' ? post.text.slice(0, TEXT_MAX) : ''
  if (!tweetId || !text.trim()) {
    return NextResponse.json({ error: 'Pick a post to reply to first.' }, { status: 400 })
  }
  const authorHandle = typeof post.authorHandle === 'string' ? post.authorHandle : undefined
  const angle = typeof b.angle === 'string' ? b.angle : undefined
  const angleType = typeof b.angleType === 'string' ? b.angleType : undefined
  const profileId = typeof b.profileId === 'string' ? b.profileId : undefined

  // Metered by credits (staff unlimited). Pre-check, then charge after variants.
  const staff = isStaff(session.email)
  if (!staff) {
    await resetIfDue(session.userId) // refill the free allowance if its cycle elapsed
    const balance = await getBalance(session.userId)
    if (balance < COST_PER_REPLY) {
      return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: COST_PER_REPLY, balance }, { status: 402 })
    }
  }

  let chargeLedgerId: string | undefined // refund target if anything fails after charging (§5)

  try {
    const result = await generateReplyVariants(session.userId, profileId, { text, authorHandle, angle, angleType }, 3)
    if (result.needsVoice) {
      return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })
    }
    if (result.clarify && result.variants.length === 0) {
      return NextResponse.json({ ask: result.clarify, voiceName: result.voiceName })
    }

    // Reply variants produced → charge once (atomic, never negative).
    if (!staff) {
      try {
        const charge = await deduct(session.userId, COST_PER_REPLY, 'reply', { refId: tweetId, metadata: { kind: 'reply' } })
        chargeLedgerId = charge.ledgerId
      } catch (e) {
        if (e instanceof InsufficientCreditsError)
          return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: e.cost, balance: e.balance }, { status: 402 })
        throw e
      }
    }
    const creditsLeft = staff ? undefined : await getBalance(session.userId)
    const variants = result.variants.map((d) => d.fullText)
    return NextResponse.json({ variants, tweetId, voiceName: result.voiceName, creditsLeft })
  } catch (err) {
    if (chargeLedgerId) await refund(session.userId, chargeLedgerId).catch(() => {})
    if (err instanceof VoiceNotReadyError) {
      return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })
    }
    if (err instanceof ModelBusyError) {
      return NextResponse.json({ error: err.message, retryable: true }, { status: 503 })
    }
    console.error('[reply/generate] failed:', err)
    return NextResponse.json({ error: "Couldn't write a reply. Try again." }, { status: 500 })
  }
}
