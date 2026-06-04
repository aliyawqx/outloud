import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { ComposeHome } from '@/components/app/ComposeHome'

export const metadata = { title: 'Outloud | Compose' }

export default async function AppHomePage() {
  const session = await getSession()
  if (!session) return null // layout already guards; keeps types happy

  const [profile, voices] = await Promise.all([
    getProfile(session.userId),
    listProfiles(session.userId),
  ])
  const firstName = (profile?.displayName || session.email).split('@')[0].split(' ')[0]

  return (
    <ComposeHome
      name={firstName}
      voices={voices.map((v) => ({ id: v.id, name: v.name, isActive: v.isActive }))}
    />
  )
}
