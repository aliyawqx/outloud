import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { getComposeEntry } from '@/lib/voice/history'
import { listPrompts } from '@/lib/prompts/store'
import { SEED_PROMPTS } from '@/lib/prompts/seeds'
import { DRAFT_LIMIT, isStaff } from '@/lib/appLock'
import { hasReadyVoice, isVoiceReady } from '@/lib/voice/ready'
import { ComposeHome, type ComposeSession } from '@/components/app/ComposeHome'

export const metadata = { title: 'Outloud | Compose' }

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await getSession()
  if (!session) return null // layout already guards; keeps types happy

  const [profile, voices] = await Promise.all([
    getProfile(session.userId),
    listProfiles(session.userId),
  ])

  // The gate: no usable voice yet → onboarding is the only way in. No generation
  // without a voice, and never a silent default.
  if (!hasReadyVoice(voices)) redirect('/app/onboarding')

  // Only ready voices can be written in.
  const readyVoices = voices.filter(isVoiceReady)
  const firstName = (profile?.displayName || session.email).split('@')[0].split(' ')[0]
  // Slash-menu commands: built-in Outloud formats + the user's own custom ones.
  const custom = await listPrompts(session.userId)
  const commands = [
    ...SEED_PROMPTS.map((s) => ({ command: s.command, title: s.title })),
    ...custom.map((p) => ({ command: p.command, title: p.title })),
  ]
  // Remaining drafts for participants (null = unlimited / staff).
  const draftsLeft = isStaff(session.email) ? null : Math.max(0, DRAFT_LIMIT - (profile?.draftsUsed ?? 0))

  // Reopening a past chat from History (?session=<id>) → restore the transcript.
  const { session: sessionId } = await searchParams
  let initialSession: ComposeSession | undefined
  if (sessionId) {
    const entry = await getComposeEntry(session.userId, sessionId)
    if (entry && entry.messages.length > 0) {
      initialSession = {
        historyId: entry.id,
        voiceId: readyVoices.some((v) => v.id === entry.voiceProfileId) ? entry.voiceProfileId ?? undefined : undefined,
        turns: entry.messages,
      }
    }
  }

  return (
    // key on the session id (or "new") forces a fresh mount when switching chats or
    // starting a new one, so the composer always reflects the chosen transcript and
    // never keeps the previous chat's state.
    <ComposeHome
      key={sessionId ?? 'new'}
      name={firstName}
      voices={readyVoices.map((v) => ({ id: v.id, name: v.name, isActive: v.isActive }))}
      commands={commands}
      draftsLeft={draftsLeft}
      initialSession={initialSession}
    />
  )
}
