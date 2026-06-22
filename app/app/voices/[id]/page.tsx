import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile, listProfiles } from '@/lib/voice/store'
import { listSamples } from '@/lib/voice/samples'
import { hasReadyVoice } from '@/lib/voice/ready'
import { StylePage } from '@/components/voice/StylePage'

export const metadata = { title: 'Outloud | Voice style' }

export default async function VoiceStylePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return null
  const { id } = await params
  const [profile, allProfiles, samples] = await Promise.all([
    getProfile(session.userId, id),
    listProfiles(session.userId),
    listSamples(session.userId, id),
  ])
  if (!profile) notFound()

  // No usable voice anywhere yet → this is the onboarding flow; generating the guide
  // should send the user into the app, and the back link returns to setup.
  const onboarding = !hasReadyVoice(allProfiles)
  return <StylePage profile={profile} initialSamples={samples} onboarding={onboarding} />
}
