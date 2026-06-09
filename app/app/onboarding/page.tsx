import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { listSamples } from '@/lib/voice/samples'
import { hasReadyVoice } from '@/lib/voice/ready'
import { VoiceOnboarding } from '@/components/app/VoiceOnboarding'

export const metadata = { title: 'Outloud | Set up your voice' }

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) return null // layout guards auth

  const [voices, profile] = await Promise.all([
    listProfiles(session.userId),
    getProfile(session.userId),
  ])
  // Returning users who already have a usable voice skip onboarding entirely.
  if (hasReadyVoice(voices)) redirect('/app')

  // Reuse an in-progress own-voice draft if one exists (e.g. samples added but
  // extraction not run yet); otherwise the client creates one on first sample.
  const draft = voices.find((v) => v.kind === 'own') ?? null
  const samples = draft ? await listSamples(session.userId, draft.id) : []

  // Default name for the captured voice = the author themselves (their display
  // name, else the local part of their email), instead of a generic "My voice".
  const authorName = profile?.displayName?.trim() || session.email.split('@')[0]

  return (
    <VoiceOnboarding
      profileId={draft?.id ?? null}
      authorName={authorName}
      initialSamples={samples.map((s) => ({ id: s.id, source: s.source, text: s.text }))}
    />
  )
}
