import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { hasReadyVoice, isVoiceReady } from '@/lib/voice/ready'
import { getAccount } from '@/lib/x/store'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { DRAFT_LIMIT, isStaff } from '@/lib/appLock'
import { ReplyStudio } from '@/components/app/ReplyStudio'

export const metadata = { title: 'Outloud | New reply' }

export default async function ReplyPage() {
  const session = await getSession()
  if (!session) return null // layout guards auth

  const [profile, voices, x, threads] = await Promise.all([
    getProfile(session.userId),
    listProfiles(session.userId),
    getAccount(session.userId),
    getThreadsAccount(session.userId),
  ])

  // Same no-voice gate as posts: no captured voice → onboarding, no generation.
  if (!hasReadyVoice(voices)) redirect('/app/onboarding')

  const readyVoices = voices.filter(isVoiceReady)
  const draftsLeft = isStaff(session.email) ? null : Math.max(0, DRAFT_LIMIT - (profile?.draftsUsed ?? 0))

  return (
    <ReplyStudio
      voices={readyVoices.map((v) => ({ id: v.id, name: v.name, isActive: v.isActive }))}
      xConnected={Boolean(x)}
      threadsConnected={Boolean(threads)}
      draftsLeft={draftsLeft}
    />
  )
}
