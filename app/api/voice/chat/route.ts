import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, listProfiles } from '@/lib/voice/store'
import { listEnabledTexts } from '@/lib/voice/samples'
import { appendDraft, saveComposeSession } from '@/lib/voice/history'
import { isVoiceReady } from '@/lib/voice/ready'
import { runIntake, type ChatTurn } from '@/lib/anthropic'
import { generatePost, VoiceNotReadyError } from '@/lib/voice/generate'

const MAX_TURNS = 40
const CONTENT_MAX = 4000

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

  const raw = Array.isArray(b.messages) ? b.messages : []
  const messages: ChatTurn[] = raw
    .filter((m): m is { role: unknown; content: unknown } => Boolean(m) && typeof (m as { content?: unknown }).content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).slice(0, CONTENT_MAX),
    }))
  if (!messages.some((m) => m.role === 'user' && m.content.trim())) {
    return NextResponse.json({ error: 'Tell me what you want to post about.' }, { status: 400 })
  }

  // Resolve the voice (the one chosen, else the first ready one) and require it.
  const profile =
    typeof b.profileId === 'string' && b.profileId
      ? await getProfile(session.userId, b.profileId)
      : (await listProfiles(session.userId)).find(isVoiceReady) ?? null
  if (!profile || !isVoiceReady(profile)) {
    return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })
  }

  // When iterating on an existing draft, edit THAT draft (keeps the voice and
  // length) instead of regenerating from scratch, which can drift off-voice.
  const lastDraft = typeof b.lastDraft === 'string' && b.lastDraft.trim() ? b.lastDraft.trim() : undefined
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  try {
    const intake = await runIntake(messages)
    if (intake.action === 'ask') {
      return NextResponse.json({ ask: intake.question, voiceName: profile.name })
    }
    const samples = await listEnabledTexts(session.userId, profile.id, 5)
    const { drafts, clarify } = await generatePost({
      idea: lastDraft ? lastUserMessage : intake.brief,
      reviseBase: lastDraft,
      voiceProfile: profile,
      samples,
      count: 1,
    })
    if (clarify && drafts.length === 0) {
      return NextResponse.json({ ask: clarify, voiceName: profile.name })
    }
    // History (best-effort): ONE entry per chat. The first draft creates it; later
    // drafts append to the same entry so a chat never splits into multiple rows.
    let historyId = typeof b.historyId === 'string' && b.historyId ? b.historyId : undefined
    try {
      if (historyId) {
        await appendDraft(session.userId, historyId, drafts[0])
      } else {
        const firstIdea = messages.find((m) => m.role === 'user')?.content || intake.brief
        const entry = await saveComposeSession({
          ownerKey: session.userId,
          voiceProfileId: profile.id,
          voiceName: profile.name,
          idea: firstIdea,
          drafts,
        })
        historyId = entry.id
      }
    } catch (e) {
      console.error('[voice/chat] history save failed:', e)
      historyId = undefined
    }
    return NextResponse.json({ draft: drafts[0], voiceName: profile.name, historyId })
  } catch (err) {
    if (err instanceof VoiceNotReadyError) {
      return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })
    }
    console.error('[voice/chat] failed:', err)
    return NextResponse.json({ error: "Couldn't write that. Try again." }, { status: 500 })
  }
}
