import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { hasReadyVoice, isVoiceReady } from '@/lib/voice/ready'
import { ComposeHome } from '@/components/app/ComposeHome'

export const metadata = { title: 'Outloud | Compose' }

export default async function AppHomePage() {
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

  return (
    <ComposeHome
      name={firstName}
      voices={readyVoices.map((v) => ({ id: v.id, name: v.name, isActive: v.isActive }))}
    />
  )
}
