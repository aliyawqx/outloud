import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { isStaff } from '@/lib/appLock'
import { deduct, refund, getBalance, resetIfDue, InsufficientCreditsError, COST_PER_REPLY } from '@/lib/credits'
import { generateReplyChat } from '@/lib/reply/generate'
import { ModelBusyError } from '@/lib/anthropic'
import { getComposeEntry, saveComposeSession, updateComposeChat } from '@/lib/voice/history'
import type { ChatTurnRecord, DraftPost, ReplyTarget } from '@/lib/voice/types'

export const maxDuration = 60

const MAX_TURNS = 60
const TEXT_MAX = 4000

/** Validate the client's chat turns into restorable records (same shape as posts). */
function parseTurns(raw: unknown): ChatTurnRecord[] {
  if (!Array.isArray(raw)) return []
  const out: ChatTurnRecord[] = []
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue
    const o = t as { role?: unknown; text?: unknown; draft?: unknown }
    const draft = o.draft as DraftPost | undefined
    if (draft && typeof draft === 'object' && typeof draft.fullText === 'string') {
      out.push({ role: 'assistant', draft })
    } else if (typeof o.text === 'string') {
      out.push({ role: o.role === 'assistant' ? 'assistant' : 'user', text: o.text.slice(0, TEXT_MAX) } as ChatTurnRecord)
    }
  }
  return out.slice(-MAX_TURNS)
}

function parseTarget(raw: unknown): (ReplyTarget & { angle?: string; angleType?: string }) | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const tweetId = typeof o.tweetId === 'string' ? o.tweetId : typeof o.id === 'string' ? o.id : ''
  const text = typeof o.text === 'string' ? o.text.slice(0, TEXT_MAX) : ''
  if (!tweetId || !text.trim()) return null
  const authorHandle = typeof o.authorHandle === 'string' ? o.authorHandle : ''
  const url = typeof o.url === 'string' && o.url ? o.url : `https://x.com/${authorHandle || 'i'}/status/${tweetId}`
  return {
    tweetId,
    url,
    authorHandle,
    text,
    angle: typeof o.angle === 'string' ? o.angle : undefined,
    angleType: typeof o.angleType === 'string' ? o.angleType : undefined,
  }
}

// POST /api/reply/chat — one step of the reply chat: write the first reply for a
// target post, or revise the current draft per the user's instruction. Saves the
// session to History with the post being replied to (replyTo).
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

  const target = parseTarget(b.target)
  if (!target) return NextResponse.json({ error: 'Pick a post to reply to first.' }, { status: 400 })

  const turns = parseTurns(b.turns)
  const profileId = typeof b.profileId === 'string' && b.profileId ? b.profileId : undefined

  // Metered by credits (staff unlimited). Pre-check, then charge after a draft.
  const staff = isStaff(session.email)
  if (!staff) {
    await resetIfDue(session.userId) // refill the free allowance if its cycle elapsed
    const balance = await getBalance(session.userId)
    if (balance < COST_PER_REPLY) {
      return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: COST_PER_REPLY, balance }, { status: 402 })
    }
  }

  // Latest draft (to revise) and latest instruction (how to revise it).
  const lastDraft = [...turns].reverse().find((t): t is { role: 'assistant'; draft: DraftPost } => 'draft' in t)?.draft.fullText
  const lastUser = [...turns].reverse().find((t): t is { role: 'user'; text: string } => t.role === 'user' && 'text' in t)?.text

  let chargeLedgerId: string | undefined // refund target if anything fails after charging (§5)

  try {
    const result = await generateReplyChat(
      session.userId,
      profileId,
      { text: target.text, authorHandle: target.authorHandle, angle: target.angle, angleType: target.angleType },
      lastDraft ? { reviseBase: lastDraft, instruction: lastUser } : {},
    )
    if (result.needsVoice) return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })
    if (result.clarify && !result.draft) return NextResponse.json({ ask: result.clarify, voiceName: result.voiceName })
    if (!result.draft) return NextResponse.json({ error: "Couldn't write a reply. Try again." }, { status: 500 })

    // A reply draft was produced → charge for it (atomic, never negative).
    if (!staff) {
      try {
        const charge = await deduct(session.userId, COST_PER_REPLY, 'reply', { refId: target.tweetId, metadata: { kind: 'reply' } })
        chargeLedgerId = charge.ledgerId
      } catch (e) {
        if (e instanceof InsufficientCreditsError)
          return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: e.cost, balance: e.balance }, { status: 402 })
        throw e
      }
    }

    // History (best-effort): ONE entry per reply chat, with the target post.
    const replyTo: ReplyTarget = { tweetId: target.tweetId, url: target.url, authorHandle: target.authorHandle, text: target.text }
    const fullTurns: ChatTurnRecord[] = [...turns, { role: 'assistant', draft: result.draft }]
    const allDrafts = fullTurns.flatMap((t) => ('draft' in t ? [t.draft] : []))
    let historyId = typeof b.historyId === 'string' && b.historyId ? b.historyId : undefined
    try {
      if (historyId && (await getComposeEntry(session.userId, historyId))) {
        await updateComposeChat(session.userId, historyId, { drafts: allDrafts, messages: fullTurns })
      } else {
        const ideaLabel = `Reply to @${target.authorHandle || 'post'}: ${target.text.slice(0, 120)}`
        const entry = await saveComposeSession({
          ownerKey: session.userId,
          voiceProfileId: result.voiceProfileId,
          voiceName: result.voiceName,
          idea: ideaLabel,
          drafts: allDrafts,
          messages: fullTurns,
          replyTo,
        })
        historyId = entry.id
      }
    } catch (e) {
      console.error('[reply/chat] history save failed:', e)
      historyId = undefined
    }

    const creditsLeft = staff ? undefined : await getBalance(session.userId)
    return NextResponse.json({ draft: result.draft, voiceName: result.voiceName, historyId, creditsLeft })
  } catch (err) {
    if (chargeLedgerId) await refund(session.userId, chargeLedgerId).catch(() => {})
    if (err instanceof ModelBusyError) {
      return NextResponse.json({ error: err.message, retryable: true }, { status: 503 })
    }
    console.error('[reply/chat] failed:', err)
    return NextResponse.json({ error: "Couldn't write a reply. Try again." }, { status: 500 })
  }
}
