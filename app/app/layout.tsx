import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { listComposeHistory } from '@/lib/voice/history'
import { isEmailVerified } from '@/lib/auth/verify'
import { AppSidebar } from '@/components/app/AppSidebar'
import { CreditsProvider } from '@/components/app/CreditsContext'
import { TrialGate } from '@/components/app/TrialGate'
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

  const unlimited = isStaff(session.email)

  // Active card-free window = existing-user grant: trialing, NO Polar subscription,
  // still has credits, and within its 7-day window. Those users skip the gate.
  const inCardFreeWindow = Boolean(
    profile?.trialing &&
      !profile?.polarSubscriptionId &&
      (profile?.creditBalance ?? 0) > 0 &&
      profile?.creditsResetAt &&
      new Date(profile.creditsResetAt).getTime() > Date.now(),
  )

  // Gate everyone else who is on the free plan: brand-new users (pick a plan + add a
  // card to start the Polar trial) and existing users whose card-free window ended
  // (subscribe — charged immediately since they already used their trial window).
  if (!unlimited && (profile?.plan ?? 'free') === 'free' && !inCardFreeWindow) {
    return (
      <TrialGate
        name={(profile?.displayName || session.email).split('@')[0].split(' ')[0]}
        trialUsed={Boolean(profile?.trialUsed)}
      />
    )
  }

  // Live credit balance for the header; expire a card-free window that has run its
  // course (no-op for paid/staff and for windows still in progress).
  const topup = profile?.topupBalance ?? 0
  let creditBalance = (profile?.creditBalance ?? 0) + topup // plan/trial + persistent top-up
  if (!unlimited) {
    const reset = await resetIfDue(session.userId)
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
