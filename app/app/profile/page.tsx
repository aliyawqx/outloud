import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { ProfileForm } from '@/components/app/ProfileForm'
import { XConnection } from '@/components/app/XConnection'
import { ThreadsConnection } from '@/components/app/ThreadsConnection'
import { DeleteAccount } from '@/components/app/DeleteAccount'

export const metadata = { title: 'Outloud | Profile' }

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ x?: string; threads?: string }> }) {
  const session = await getSession()
  if (!session) return null
  const profile = await getProfile(session.userId)
  const { x, threads } = await searchParams
  const flash = x === 'connected' || x === 'error' ? x : undefined
  const threadsFlash = threads === 'connected' || threads === 'error' ? threads : undefined

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 font-headline-xl text-headline-xl">Your profile</h1>
      <p className="mb-8 font-body-md text-body-md text-on-surface-variant">{session.email}</p>
      <ProfileForm
        initial={{
          displayName: profile?.displayName ?? '',
          handle: profile?.handle ?? '',
          avatarUrl: profile?.avatarUrl ?? '',
          plan: profile?.plan ?? 'free',
        }}
      />

      <div className="mt-8 flex flex-col gap-4">
        <XConnection flash={flash} />
        <ThreadsConnection flash={threadsFlash} />
      </div>
      <DeleteAccount />
    </div>
  )
}
