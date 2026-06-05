import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile, listProfiles } from '@/lib/voice/store'
import { listEnabledTexts } from '@/lib/voice/samples'
import { generatePost, VoiceNotReadyError } from '@/lib/voice/generate'
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

  try {
    const samples = await listEnabledTexts(session.userId, profile.id, 5)
    const drafts = await generatePost({
      idea,
      voiceProfile: profile,
      samples,
      count,
      hookIntensity,
      link,
      dayNumber: challengeDay(),
      followerCount: followerCount(),
    })
    return NextResponse.json({ drafts, voiceName: profile.name })
  } catch (err) {
    if (err instanceof VoiceNotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[compose] failed:', err)
    return NextResponse.json({ error: "Couldn't generate posts. Try again." }, { status: 500 })
  }
}
