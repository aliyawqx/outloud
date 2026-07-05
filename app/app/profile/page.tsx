import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { ProfileForm } from '@/components/app/ProfileForm'
import { XConnection } from '@/components/app/XConnection'
import { ThreadsConnection } from '@/components/app/ThreadsConnection'
import { LinkedInConnection } from '@/components/app/LinkedInConnection'
import { DeleteAccount } from '@/components/app/DeleteAccount'
import { ReplayTours } from '@/components/app/onboarding/ReplayTours'
import { WatchIntroButton } from '@/components/app/onboarding/WatchIntroButton'

export const metadata = { title: 'Outloud | Profile' }

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ x?: string; threads?: string; linkedin?: string }>
}) {
  const session = await getSession()
  if (!session) return null
  const profile = await getProfile(session.userId)
  const { x, threads, linkedin } = await searchParams
  const flash = x === 'connected' || x === 'error' ? x : undefined
  const threadsFlash = threads === 'connected' || threads === 'error' ? threads : undefined
  const linkedinFlash = linkedin === 'connected' || linkedin === 'error' ? linkedin : undefined

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 font-headline-xl text-headline-xl">Your profile</h1>
      <p className="mb-8 font-body-md text-body-md text-on-surface-variant">{session.email}</p>
      <div data-tour="account-settings">
        <ProfileForm
          initial={{
            displayName: profile?.displayName ?? '',
            handle: profile?.handle ?? '',
            avatarUrl: profile?.avatarUrl ?? '',
            plan: profile?.plan ?? 'free',
          }}
        />
      </div>

      <div data-tour="connections" className="mt-8 flex flex-col gap-4">
        <XConnection flash={flash} />
        <ThreadsConnection flash={threadsFlash} />
        <LinkedInConnection flash={linkedinFlash} />
      </div>
      <ReplayTours />
      <div className="mt-3 flex justify-end">
        <WatchIntroButton />
      </div>
      <DeleteAccount />
    </div>
  )
}
