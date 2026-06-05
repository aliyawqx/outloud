import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/voice/store'
import { listSamples } from '@/lib/voice/samples'
import { StylePage } from '@/components/voice/StylePage'

export const metadata = { title: 'Outloud | Voice style' }

export default async function VoiceStylePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return null
  const { id } = await params
  const profile = await getProfile(session.userId, id)
  if (!profile) notFound()

  const samples = await listSamples(session.userId, id)
  return <StylePage profile={profile} initialSamples={samples} />
}
