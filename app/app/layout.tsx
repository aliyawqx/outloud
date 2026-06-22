import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { listComposeHistory } from '@/lib/voice/history'
import { isEmailVerified } from '@/lib/auth/verify'
import { AppSidebar } from '@/components/app/AppSidebar'
import { CreditsProvider } from '@/components/app/CreditsContext'
import { VerifyEmail } from '@/components/app/VerifyEmail'
import { isStaff } from '@/lib/appLock'
import { resetIfDue } from '@/lib/credits'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/signup')

  const [profile, voices, verified, history] = await Promise.all([
    getProfile(session.userId),
    listProfiles(session.userId),
    isEmailVerified(session.userId),
    listComposeHistory(session.userId, 50),
  ])

  // Email verification comes first: a freshly signed-up user must enter the code
  // we emailed before anything else.
  if (!verified) return <VerifyEmail email={session.email} />

  // No card wall up front: everyone gets a 7-day card-free trial on signup. When it
  // expires, resetIfDue zeroes the credits and the user hits the upgrade paywall on
  // their next action (paid plans charge immediately via Polar).
  const unlimited = isStaff(session.email)
  const topup = profile?.topupBalance ?? 0
  let creditBalance = (profile?.creditBalance ?? 0) + topup // plan/trial + persistent top-up
  if (!unlimited) {
    const reset = await resetIfDue(session.userId) // expires the trial when due (top-up untouched)
    if (reset != null) creditBalance = reset + topup
  }

  return (
    <CreditsProvider initialBalance={creditBalance} unlimited={unlimited}>
      <div className="min-h-screen lg:flex">
        <AppSidebar
          profile={{
            displayName: profile?.displayName || session.email,
            avatarUrl: profile?.avatarUrl ?? null,
            plan: profile?.plan ?? 'free',
          }}
          voiceCount={voices.length}
          history={history.map((e) => ({ id: e.id, title: e.idea }))}
        />
        <main className="relative min-w-0 flex-1 px-margin-mobile py-8 md:px-10 lg:px-12">{children}</main>
      </div>
    </CreditsProvider>
  )
}
