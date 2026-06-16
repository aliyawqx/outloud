import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, listProfiles } from '@/lib/voice/store'
import { listEnabledTexts } from '@/lib/voice/samples'
import { getComposeEntry, saveComposeSession, updateComposeChat } from '@/lib/voice/history'
import { isStaff } from '@/lib/appLock'
import { deduct, getBalance, InsufficientCreditsError, POST_COST } from '@/lib/credits'
import { isVoiceReady } from '@/lib/voice/ready'
import { getPromptText } from '@/lib/prompts/store'
import { DEFAULT_COMMAND, seedText } from '@/lib/prompts/seeds'
import { runIntake, ModelBusyError, type ChatTurn } from '@/lib/anthropic'
import { generatePost, VoiceNotReadyError } from '@/lib/voice/generate'
import type { ChatTurnRecord, DraftPost } from '@/lib/voice/types'

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
  if (!staff && (await getBalance(session.userId)) < POST_COST) {
    return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: POST_COST, balance: await getBalance(session.userId) }, { status: 402 })
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

  try {
    const intake = await runIntake(messages, formatText ?? undefined)
    if (intake.action === 'ask') {
      // A question IS the first AI answer — persist the chat now so it shows up in
      // History even before any draft exists.
      const fullTurns: ChatTurnRecord[] = [...turns, { role: 'assistant', text: intake.question, options: intake.options }]
      const allDrafts = fullTurns.flatMap((t) => ('draft' in t ? [t.draft] : []))
      const historyId = await persistHistory({
        ownerKey: session.userId,
        voiceProfileId: profile.id,
        voiceName: profile.name,
        idea: firstIdea || intake.question,
        drafts: allDrafts,
        messages: fullTurns,
        historyId: priorHistoryId,
      })
      return NextResponse.json({ ask: intake.question, options: intake.options, voiceName: profile.name, historyId })
    }
    // Charge for the post atomically, right before generating it.
    if (!staff) {
      try {
        await deduct(session.userId, POST_COST, 'post', { kind: 'post', command })
      } catch (e) {
        if (e instanceof InsufficientCreditsError)
          return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: e.cost, balance: e.balance }, { status: 402 })
        throw e
      }
    }
    const samples = await listEnabledTexts(session.userId, profile.id, 5)
    const { drafts, clarify } = await generatePost({
      idea: lastDraft ? lastUserMessage : intake.brief,
      reviseBase: lastDraft,
      formatText,
      voiceProfile: profile,
      samples,
      count: 1,
    })
    if (clarify && drafts.length === 0) {
      // A generation-time clarification is also a first AI answer — persist it too.
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
      return NextResponse.json({ ask: clarify, voiceName: profile.name, historyId })
    }

    // ONE entry per chat. Persist the full transcript so the session can be reopened
    // and continued. drafts = every draft in the transcript.
    const fullTurns: ChatTurnRecord[] = [...turns, { role: 'assistant', draft: drafts[0] }]
    const allDrafts = fullTurns.flatMap((t) => ('draft' in t ? [t.draft] : []))
    const historyId = await persistHistory({
      ownerKey: session.userId,
      voiceProfileId: profile.id,
      voiceName: profile.name,
      idea: firstIdea || intake.brief,
      drafts: allDrafts,
      messages: fullTurns,
      historyId: priorHistoryId,
    })
    const creditsLeft = staff ? undefined : await getBalance(session.userId)
    return NextResponse.json({ draft: drafts[0], voiceName: profile.name, historyId, creditsLeft })
  } catch (err) {
    if (err instanceof VoiceNotReadyError) {
      return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })
    }
    if (err instanceof ModelBusyError) {
      return NextResponse.json({ error: err.message, retryable: true }, { status: 503 })
    }
    console.error('[voice/chat] failed:', err)
    return NextResponse.json({ error: "Couldn't write that. Try again." }, { status: 500 })
  }
}
