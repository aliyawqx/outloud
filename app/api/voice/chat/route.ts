import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, listProfiles } from '@/lib/voice/store'
import { listEnabledTexts } from '@/lib/voice/samples'
import { getComposeEntry, saveComposeSession, updateComposeChat } from '@/lib/voice/history'
import { getProfile as getUserProfile, incrementDraftsUsed } from '@/lib/profile/store'
import { DRAFT_LIMIT, isStaff } from '@/lib/appLock'
import { isVoiceReady } from '@/lib/voice/ready'
import { getPromptText } from '@/lib/prompts/store'
import { DEFAULT_COMMAND, seedText } from '@/lib/prompts/seeds'
import { runIntake, type ChatTurn } from '@/lib/anthropic'
import { generatePost, VoiceNotReadyError } from '@/lib/voice/generate'
import type { ChatTurnRecord, DraftPost } from '@/lib/voice/types'

const MAX_TURNS = 60
const TEXT_MAX = 4000

/** Validate the client's chat turns into restorable records. */
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

const toContent = (t: ChatTurnRecord): ChatTurn =>
  'draft' in t ? { role: 'assistant', content: t.draft.fullText } : { role: t.role, content: t.text }

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

  // Draft cap: incubator participants get DRAFT_LIMIT lifetime drafts; staff unlimited.
  const capped = !isStaff(session.email)
  if (capped) {
    const up = await getUserProfile(session.userId)
    if ((up?.draftsUsed ?? 0) >= DRAFT_LIMIT) {
      return NextResponse.json(
        { error: `You've used all ${DRAFT_LIMIT} of your drafts.`, limitReached: true, draftsLeft: 0 },
        { status: 403 },
      )
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

  try {
    const intake = await runIntake(messages, formatText ?? undefined)
    if (intake.action === 'ask') {
      return NextResponse.json({ ask: intake.question, voiceName: profile.name })
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
      return NextResponse.json({ ask: clarify, voiceName: profile.name })
    }

    // History (best-effort): ONE entry per chat. Persist the full transcript so the
    // session can be reopened and continued. drafts = every draft in the transcript.
    const fullTurns: ChatTurnRecord[] = [...turns, { role: 'assistant', draft: drafts[0] }]
    const allDrafts = fullTurns.flatMap((t) => ('draft' in t ? [t.draft] : []))
    let historyId = typeof b.historyId === 'string' && b.historyId ? b.historyId : undefined
    try {
      if (historyId && (await getComposeEntry(session.userId, historyId))) {
        await updateComposeChat(session.userId, historyId, { drafts: allDrafts, messages: fullTurns })
      } else {
        const firstIdea = turns.find((t): t is { role: 'user'; text: string } => t.role === 'user' && 'text' in t)?.text || intake.brief
        const entry = await saveComposeSession({
          ownerKey: session.userId,
          voiceProfileId: profile.id,
          voiceName: profile.name,
          idea: firstIdea,
          drafts: allDrafts,
          messages: fullTurns,
        })
        historyId = entry.id
      }
    } catch (e) {
      console.error('[voice/chat] history save failed:', e)
      historyId = undefined
    }
    // A draft was produced → count it toward the cap (revisions count too).
    let draftsLeft: number | undefined
    if (capped) {
      const used = await incrementDraftsUsed(session.userId)
      draftsLeft = Math.max(0, DRAFT_LIMIT - used)
    }
    return NextResponse.json({ draft: drafts[0], voiceName: profile.name, historyId, draftsLeft })
  } catch (err) {
    if (err instanceof VoiceNotReadyError) {
      return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })
    }
    console.error('[voice/chat] failed:', err)
    return NextResponse.json({ error: "Couldn't write that. Try again." }, { status: 500 })
  }
}
