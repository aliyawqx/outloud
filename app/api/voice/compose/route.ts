import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, listProfiles } from '@/lib/voice/store'
import { listEnabledTexts } from '@/lib/voice/samples'
import { generatePost, VoiceNotReadyError } from '@/lib/voice/generate'
import { saveComposeSession } from '@/lib/voice/history'
import { challengeDay, followerCount } from '@/lib/voice/challenge'
import type { HookIntensity } from '@/lib/voice/types'

const IDEA_MAX = 2000
const INTENSITIES: HookIntensity[] = ['safe', 'bold', 'spicy', 'funny']

// POST /api/voice/compose — generate N drafts for an idea in the chosen/active voice.
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

  const idea = typeof b.idea === 'string' ? b.idea.trim() : ''
  if (!idea) return NextResponse.json({ error: 'Tell me what you shipped.' }, { status: 400 })
  if (idea.length > IDEA_MAX) return NextResponse.json({ error: 'Keep your idea shorter.' }, { status: 400 })

  const count = Math.min(4, Math.max(1, Number(b.count) || 1))
  const hookIntensity = INTENSITIES.includes(b.hookIntensity as HookIntensity)
    ? (b.hookIntensity as HookIntensity)
    : 'bold'
  const link = typeof b.link === 'string' && b.link.trim() ? b.link.trim() : undefined

  const profile =
    typeof b.profileId === 'string' && b.profileId
      ? await getProfile(session.userId, b.profileId)
      : (await listProfiles(session.userId)).find((p) => p.isActive) ?? null
  if (!profile) {
    return NextResponse.json({ error: 'No voice selected. Pick or set one active first.' }, { status: 400 })
  }

  // Challenge/progress framing (Day N · followers) is opt-in per request, not the default.
  const challenge = b.challenge === true

  try {
    const samples = await listEnabledTexts(session.userId, profile.id, 5)
    const { drafts, clarify } = await generatePost({
      idea,
      voiceProfile: profile,
      samples,
      count,
      hookIntensity,
      link,
      ...(challenge ? { dayNumber: challengeDay(), followerCount: followerCount() } : {}),
    })

    // Unclear idea → ask for more detail; no draft, nothing saved to history.
    if (clarify && drafts.length === 0) {
      return NextResponse.json({ clarify, voiceName: profile.name })
    }

    // Save the session for History (best-effort — never fail the response on this).
    let historyId: string | undefined
    try {
      const entry = await saveComposeSession({
        ownerKey: session.userId,
        voiceProfileId: profile.id,
        voiceName: profile.name,
        idea,
        drafts,
      })
      historyId = entry.id
    } catch (e) {
      console.error('[compose] history save failed:', e)
    }

    return NextResponse.json({ drafts, voiceName: profile.name, historyId })
  } catch (err) {
    if (err instanceof VoiceNotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[compose] failed:', err)
    return NextResponse.json({ error: "Couldn't generate posts. Try again." }, { status: 500 })
  }
}
