import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { listSamples } from '@/lib/voice/samples'
import { listComposeHistory } from '@/lib/voice/history'
import { hasReadyVoice } from '@/lib/voice/ready'
import { isEmailVerified } from '@/lib/auth/verify'
import { AppSidebar } from '@/components/app/AppSidebar'
import { CreditsProvider } from '@/components/app/CreditsContext'
import { TrialGate } from '@/components/app/TrialGate'
import { VoiceOnboarding } from '@/components/app/VoiceOnboarding'
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

  // Onboarding runs BEFORE payment for everyone: no usable voice yet → set it up first
  // (name the voice + give it a source). It persists immediately, so a new user who then
  // bails at the payment step doesn't have to redo it. New users go onboarding → payment
  // (the gate below); existing in-window users go onboarding → straight into the app.
  //
  // Only /app/voices is exempt (picking a creator voice IS an onboarding path and needs the
  // full library view). The onboarding takeover itself is rendered inline by this layout for
  // EVERY other path while no voice is ready — including /app/onboarding, where the X-connect
  // flow returns. NOT exempting /app/onboarding is deliberate: it keeps the user on the bare
  // onboarding screen (no sidebar, no feature access, payment gate intact) until the voice +
  // Style Guide are actually generated. Only then does hasReadyVoice flip and let them into
  // the app and its subscription gate.
  const pathname = (await headers()).get('x-pathname') ?? ''
  const gateExempt = pathname.startsWith('/app/voices')
  if (!hasReadyVoice(voices) && !gateExempt) {
    const draft = voices.find((v) => v.kind === 'own') ?? null
    const samples = draft ? await listSamples(session.userId, draft.id) : []
    const authorName = profile?.displayName?.trim() || session.email.split('@')[0]
    return (
      <VoiceOnboarding
        profileId={draft?.id ?? null}
        authorName={authorName}
        initialSamples={samples.map((s) => ({ id: s.id, source: s.source, text: s.text }))}
      />
    )
  }

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
  if (!unlimited && !gateExempt && (profile?.plan ?? 'free') === 'free' && !inCardFreeWindow) {
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
