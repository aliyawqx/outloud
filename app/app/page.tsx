import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { getAccount as getXAccount } from '@/lib/x/store'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { getAccount as getLinkedInAccount } from '@/lib/linkedin/store'
import { getComposeEntry } from '@/lib/voice/history'
import { listPrompts } from '@/lib/prompts/store'
import { SEED_PROMPTS } from '@/lib/prompts/seeds'
import { hasReadyVoice, isVoiceReady } from '@/lib/voice/ready'
import { ComposeHome, type ComposeSession } from '@/components/app/ComposeHome'
import { PlanWelcome } from '@/components/app/PlanWelcome'

export const metadata = { title: 'Outloud | Compose' }

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ session?: string; upgraded?: string }> }) {
  const session = await getSession()
  if (!session) return null // layout already guards; keeps types happy

  const [profile, voices, xAccount, threadsAccount, linkedInAccount] = await Promise.all([
    getProfile(session.userId),
    listProfiles(session.userId),
    getXAccount(session.userId),
    getThreadsAccount(session.userId),
    getLinkedInAccount(session.userId),
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
  // Reopening a past chat from History (?session=<id>) → restore the transcript.
  const { session: sessionId, upgraded } = await searchParams
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
    <>
      {/* Celebration: after checkout (?upgraded=) always; for an existing paid
          user once (PlanWelcome remembers in localStorage). */}
      {upgraded === 'starter' || upgraded === 'pro' ? (
        <PlanWelcome plan={upgraded} fromCheckout />
      ) : profile?.plan === 'starter' || profile?.plan === 'pro' ? (
        <PlanWelcome plan={profile.plan} />
      ) : null}
      {/* key on the session id (or "new") forces a fresh mount when switching chats or
          starting a new one, so the composer always reflects the chosen transcript and
          never keeps the previous chat's state. */}
      <ComposeHome
      key={sessionId ?? 'new'}
      name={firstName}
      voices={readyVoices.map((v) => ({ id: v.id, name: v.name, isActive: v.isActive }))}
      commands={commands}
      initialSession={initialSession}
      xConnected={Boolean(xAccount)}
      threadsConnected={Boolean(threadsAccount)}
      linkedInConnected={Boolean(linkedInAccount && linkedInAccount.status === 'connected')}
      />
    </>
  )
}
