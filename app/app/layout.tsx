import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { isEmailVerified } from '@/lib/auth/verify'
import { AppSidebar } from '@/components/app/AppSidebar'
import { AccessGate } from '@/components/app/AccessGate'
import { Unavailable } from '@/components/app/Unavailable'
import { VerifyEmail } from '@/components/app/VerifyEmail'
import { isStaff } from '@/lib/appLock'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/signup')

  const [profile, voices, verified] = await Promise.all([
    getProfile(session.userId),
    listProfiles(session.userId),
    isEmailVerified(session.userId),
  ])

  // Email verification comes first: a freshly signed-up user must enter the code
  // we emailed before anything else (including the incubator question).
  if (!verified) return <VerifyEmail email={session.email} />

  // Access gate: staff skip it. Everyone else answers the incubator question once.
  if (!isStaff(session.email)) {
    if (profile?.incubator == null) return <AccessGate /> // not asked yet
    if (profile.incubator === 'no') return <Unavailable />
  }

  return (
    <div className="min-h-screen lg:flex">
      <AppSidebar
        profile={{
          displayName: profile?.displayName || session.email,
          avatarUrl: profile?.avatarUrl ?? null,
          plan: profile?.plan ?? 'free',
        }}
        voiceCount={voices.length}
      />
      <main className="relative min-w-0 flex-1 px-margin-mobile py-8 md:px-10 lg:px-12">{children}</main>
    </div>
  )
}
