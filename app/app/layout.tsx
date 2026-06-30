import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { listComposeHistory } from '@/lib/voice/history'
import { hasReadyVoice } from '@/lib/voice/ready'
import { isEmailVerified } from '@/lib/auth/verify'
import { AppSidebar } from '@/components/app/AppSidebar'
import { CreditsProvider } from '@/components/app/CreditsContext'
import { TrialGate } from '@/components/app/TrialGate'
import { TourController } from '@/components/app/onboarding/TourController'
import { WelcomeVideoOverlay } from '@/components/app/onboarding/WelcomeVideoOverlay'
import { VerifyEmail } from '@/components/app/VerifyEmail'
import { isStaff } from '@/lib/appLock'
import { resetIfDue, countDraftsMade, FREE_DRAFT_FLOOR } from '@/lib/credits'

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

  // Gating runs in this SERVER layout, so it must REDIRECT rather than render a takeover
  // in place of {children}: a shared layout is NOT re-rendered on client navigation, so
  // returning <Onboarding/> instead of {children} strands the user there — a <Link> (e.g.
  // "Browse the voice library") changes the URL but has nowhere to render the new page.
  // The onboarding screen therefore lives at its own route, /app/onboarding.
  const pathname = (await headers()).get('x-pathname') ?? ''
  const onOnboarding = pathname.startsWith('/app/onboarding')
  const onVoices = pathname.startsWith('/app/voices')

  // No usable voice yet → onboarding first, for everyone, BEFORE payment. /app/voices
  // (the creator-voice path) stays reachable so a user can pick a voice instead.
  if (!hasReadyVoice(voices) && !onOnboarding && !onVoices) redirect('/app/onboarding')

  // Onboarding is a full-screen takeover: render its page WITHOUT the app shell, so there's
  // no sidebar and no way into features until the voice + Style Guide actually exist. Sits
  // before the payment gate — onboarding always comes first.
  if (onOnboarding) return <>{children}</>

  const unlimited = isStaff(session.email)

  // Active card-free trial = the signup grant: trialing, NO Polar subscription, still has
  // credits, and within its 3-day window. These users draft freely and skip the gate.
  // The trial ends on whichever comes first — credits hit 0, or the window elapses — and
  // either condition flips this false, so the "keep going" gate below appears.
  const inCardFreeWindow = Boolean(
    profile?.trialing &&
      !profile?.polarSubscriptionId &&
      (profile?.creditBalance ?? 0) > 0 &&
      profile?.creditsResetAt &&
      new Date(profile.creditsResetAt).getTime() > Date.now(),
  )

  // Gate only once the free trial is truly done: a free-plan user with no active trial
  // (window ended or 10k spent) and no subscription → pick a plan to keep going (billed
  // immediately, since they've already used their card-free trial). Paid plans never hit
  // this; an in-trial user with credits never hits this.
  //
  // Hard floor (P2): never wall a user who hasn't yet made their guaranteed first drafts —
  // they must be able to reach the composer and experience drafting before any paywall,
  // regardless of balance. countDraftsMade is only queried when a gate is otherwise due.
  //
  // When the trial is over we do NOT replace the whole app with the paywall: the user
  // should LAND IN their actual account (sidebar, history, drafts all visible) and only
  // then meet the "keep going" card, rendered as a blocking overlay on top. So we just
  // compute a `gated` flag here and render the card over the normal shell below.
  const gated =
    !unlimited &&
    !onVoices &&
    (profile?.plan ?? 'free') === 'free' &&
    !inCardFreeWindow &&
    (await countDraftsMade(session.userId)) >= FREE_DRAFT_FLOOR

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
      {gated && (
        <TrialGate
          name={(profile?.displayName || session.email).split('@')[0].split(' ')[0]}
          trialUsed={Boolean(profile?.trialUsed)}
        />
      )}
      <WelcomeVideoOverlay initialState={profile?.onboardingState ?? {}} />
      <TourController initialState={profile?.onboardingState ?? {}} />
    </CreditsProvider>
  )
}
