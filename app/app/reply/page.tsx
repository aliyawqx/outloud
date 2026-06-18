import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { listProfiles } from '@/lib/voice/store'
import { hasReadyVoice, isVoiceReady } from '@/lib/voice/ready'
import { getAccount } from '@/lib/x/store'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { ReplyStudio } from '@/components/app/ReplyStudio'

export const metadata = { title: 'Outloud | New reply' }

export default async function ReplyPage() {
  const session = await getSession()
  if (!session) return null // layout guards auth

  const [voices, x, threads] = await Promise.all([
    listProfiles(session.userId),
    getAccount(session.userId),
    getThreadsAccount(session.userId),
  ])

  // Same no-voice gate as posts: no captured voice → onboarding, no generation.
  if (!hasReadyVoice(voices)) redirect('/app/onboarding')

  const readyVoices = voices.filter(isVoiceReady)

  return (
    <ReplyStudio
      voices={readyVoices.map((v) => ({ id: v.id, name: v.name, isActive: v.isActive }))}
      xConnected={Boolean(x)}
      threadsConnected={Boolean(threads)}
    />
  )
}
