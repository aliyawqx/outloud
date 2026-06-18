import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, listProfiles } from '@/lib/voice/store'
import { listEnabledTexts } from '@/lib/voice/samples'
import { getComposeEntry, saveComposeSession, updateComposeChat } from '@/lib/voice/history'
import { isStaff } from '@/lib/appLock'
import { deduct, refund, getBalance, resetIfDue, InsufficientCreditsError, COST_PER_POST } from '@/lib/credits'
import { isVoiceReady } from '@/lib/voice/ready'
import { getPromptText } from '@/lib/prompts/store'
import { DEFAULT_COMMAND, seedText } from '@/lib/prompts/seeds'
import { runIntake, ModelBusyError, type ChatTurn } from '@/lib/anthropic'
import { generatePost, VoiceNotReadyError } from '@/lib/voice/generate'
import type { ChatTurnRecord, DraftPost } from '@/lib/voice/types'
import { statusEvent, type ComposeEvent } from '@/lib/compose/stream'

// Generation can take longer than the 10s default; allow up to 60s (Hobby max).
export const maxDuration = 60

const MAX_TURNS = 60
const TEXT_MAX = 4000

/** Validate the client's chat turns into restorable records. */
function parseTurns(raw: unknown): ChatTurnRecord[] {
  if (!Array.isArray(raw)) return []
  const out: ChatTurnRecord[] = []
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue
    const o = t as { role?: unknown; text?: unknown; draft?: unknown; options?: unknown }
    const draft = o.draft as DraftPost | undefined
    if (draft && typeof draft === 'object' && typeof draft.fullText === 'string') {
      out.push({ role: 'assistant', draft })
    } else if (typeof o.text === 'string') {
      const isAssistant = o.role === 'assistant'
      const options = isAssistant && Array.isArray(o.options) ? (o.options as unknown[]).filter((x): x is string => typeof x === 'string') : undefined
      out.push({
        role: isAssistant ? 'assistant' : 'user',
        text: o.text.slice(0, TEXT_MAX),
        ...(options && options.length ? { options } : {}),
      } as ChatTurnRecord)
    }
  }
  return out.slice(-MAX_TURNS)
}

const toContent = (t: ChatTurnRecord): ChatTurn =>
  'draft' in t ? { role: 'assistant', content: t.draft.fullText } : { role: t.role, content: t.text }

/**
 * Persist the chat as ONE history entry (best-effort) and return its id. Created
 * as soon as the chat has its FIRST assistant reply — a question, a clarification,
 * or a draft — and updated in place on every later turn. Never throws.
 */
async function persistHistory(input: {
  ownerKey: string
  voiceProfileId: string
  voiceName: string
  idea: string
  drafts: DraftPost[]
  messages: ChatTurnRecord[]
  historyId?: string
}): Promise<string | undefined> {
  try {
    if (input.historyId && (await getComposeEntry(input.ownerKey, input.historyId))) {
      await updateComposeChat(input.ownerKey, input.historyId, { drafts: input.drafts, messages: input.messages })
      return input.historyId
    }
    const entry = await saveComposeSession({
      ownerKey: input.ownerKey,
      voiceProfileId: input.voiceProfileId,
      voiceName: input.voiceName,
      idea: input.idea,
      drafts: input.drafts,
      messages: input.messages,
    })
    return entry.id
  } catch (e) {
    console.error('[voice/chat] history save failed:', e)
    return undefined
  }
}

// POST /api/voice/chat — one step of the composer chat. Reads the conversation,
// then either asks ONE follow-up question or writes a draft in the user's voice.
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

  const turns = parseTurns(b.turns)
  if (!turns.some((t) => t.role === 'user' && 'text' in t && t.text.trim())) {
    return NextResponse.json({ error: 'Tell me what you want to post about.' }, { status: 400 })
  }
  const messages = turns.map(toContent)

  // Resolve the voice (the one chosen, else the first ready one) and require it.
  const profile =
    typeof b.profileId === 'string' && b.profileId
      ? await getProfile(session.userId, b.profileId)
      : (await listProfiles(session.userId)).find(isVoiceReady) ?? null
  if (!profile || !isVoiceReady(profile)) {
    return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })
  }

  // Metered by credits (staff are unlimited). Cheap pre-check so we don't run any
  // LLM work for a user who can't afford a post; the real charge is atomic below.
  const staff = isStaff(session.email)
  if (!staff) {
    await resetIfDue(session.userId) // refill the free allowance if its cycle elapsed
    const balance = await getBalance(session.userId)
    if (balance < COST_PER_POST) {
      return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: COST_PER_POST, balance }, { status: 402 })
    }
  }

  // When iterating on an existing draft, edit THAT draft (keeps the voice and
  // length) instead of regenerating, which can drift off-voice.
  const lastDraft = [...turns].reverse().find((t): t is { role: 'assistant'; draft: DraftPost } => 'draft' in t)?.draft.fullText
  const lastUserMessage = [...turns].reverse().find((t): t is { role: 'user'; text: string } => t.role === 'user' && 'text' in t)?.text ?? ''

  // Resolve the active FORMAT (slash command) up front; default to the X post.
  // Intake needs it so it asks only for content this format needs.
  const command = typeof b.command === 'string' && b.command ? b.command : DEFAULT_COMMAND
  const formatText = (await getPromptText(session.userId, command)) ?? seedText(command) ?? seedText(DEFAULT_COMMAND)

  // The first user message names the chat in the History panel.
  const firstIdea = turns.find((t): t is { role: 'user'; text: string } => t.role === 'user' && 'text' in t)?.text || lastUserMessage
  const priorHistoryId = typeof b.historyId === 'string' && b.historyId ? b.historyId : undefined

  // From here on we stream Server-Sent Events: live status lines as each real
  // pipeline stage runs, then a terminal `done` (or `error`) event carrying the
  // same payload the route used to return as JSON. Pre-stream failures above stay
  // plain JSON with their status codes; the client branches on content-type.
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: ComposeEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
      // The deduction's ledger id, so we can refund if generation fails (spec §5).
      let chargeLedgerId: string | undefined
      try {
        // Stage 1 — parse: interpret what the user actually wants (intake).
        send(statusEvent('parse'))
        const intake = await runIntake(messages, formatText ?? undefined)
        if (intake.action === 'ask') {
          // A question IS the first AI answer — persist so it shows in History now.
          const fullTurns: ChatTurnRecord[] = [...turns, { role: 'assistant', text: intake.question, options: intake.options }]
          const historyId = await persistHistory({
            ownerKey: session.userId,
            voiceProfileId: profile.id,
            voiceName: profile.name,
            idea: firstIdea || intake.question,
            drafts: fullTurns.flatMap((t) => ('draft' in t ? [t.draft] : [])),
            messages: fullTurns,
            historyId: priorHistoryId,
          })
          send({ type: 'done', ask: intake.question, options: intake.options, voiceName: profile.name, historyId })
          return
        }

        // Stage 2 — voice: pull the profile's writing samples.
        send(statusEvent('voice'))
        const samples = await listEnabledTexts(session.userId, profile.id, 5)

        // Charge atomically right before generating; keep the ledger id to refund
        // a failed/empty generation below.
        if (!staff) {
          try {
            const charge = await deduct(session.userId, COST_PER_POST, 'post', { metadata: { kind: 'post', command } })
            chargeLedgerId = charge.ledgerId
          } catch (e) {
            if (e instanceof InsufficientCreditsError) {
              send({ type: 'error', error: 'Not enough credits.', insufficientCredits: true, cost: e.cost, balance: e.balance })
              return
            }
            throw e
          }
        }

        // Stages 3-5 — context (only if the model researches), draft, polish —
        // are emitted from inside generation via onStatus, in real order.
        const { drafts, clarify } = await generatePost({
          idea: lastDraft ? lastUserMessage : intake.brief,
          reviseBase: lastDraft,
          formatText,
          voiceProfile: profile,
          samples,
          count: 1,
          onStatus: (e) => send(statusEvent(e.step, e.topic)),
        })

        if (clarify && drafts.length === 0) {
          // Charged but produced only a clarifying question, not a draft → refund (§5).
          if (chargeLedgerId) await refund(session.userId, chargeLedgerId)
          const askTurns: ChatTurnRecord[] = [...turns, { role: 'assistant', text: clarify }]
          const historyId = await persistHistory({
            ownerKey: session.userId,
            voiceProfileId: profile.id,
            voiceName: profile.name,
            idea: firstIdea || clarify,
            drafts: askTurns.flatMap((t) => ('draft' in t ? [t.draft] : [])),
            messages: askTurns,
            historyId: priorHistoryId,
          })
          const creditsLeft = staff ? undefined : await getBalance(session.userId)
          send({ type: 'done', ask: clarify, voiceName: profile.name, historyId, creditsLeft })
          return
        }

        // ONE entry per chat — persist the full transcript so it can be reopened.
        const fullTurns: ChatTurnRecord[] = [...turns, { role: 'assistant', draft: drafts[0] }]
        const historyId = await persistHistory({
          ownerKey: session.userId,
          voiceProfileId: profile.id,
          voiceName: profile.name,
          idea: firstIdea || intake.brief,
          drafts: fullTurns.flatMap((t) => ('draft' in t ? [t.draft] : [])),
          messages: fullTurns,
          historyId: priorHistoryId,
        })
        const creditsLeft = staff ? undefined : await getBalance(session.userId)
        send({ type: 'done', draft: drafts[0], voiceName: profile.name, historyId, creditsLeft })
      } catch (err) {
        // Generation failed after we charged → give the credits back (§5).
        if (chargeLedgerId) await refund(session.userId, chargeLedgerId).catch(() => {})
        if (err instanceof VoiceNotReadyError) {
          send({ type: 'error', error: 'Create a voice first.', needsVoice: true })
        } else if (err instanceof ModelBusyError) {
          send({ type: 'error', error: err.message, retryable: true })
        } else {
          console.error('[voice/chat] failed:', err)
          send({ type: 'error', error: "Couldn't write that. Try again." })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no', // disable proxy buffering so events arrive live
    },
  })
}
