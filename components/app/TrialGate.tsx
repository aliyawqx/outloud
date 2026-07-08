'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS, type BillingMode } from '@/lib/pricing'
import { PlanCard, Toggle } from '@/components/Pricing'

// Shown only once the card-free trial is done (10k credits spent OR the 3-day window
// elapsed). Framed as continuing, not a wall: the user picks a plan to keep posting and
// is billed immediately (they've already had their free trial). Uses the same plan cards
// as the landing pricing section. `trialUsed` is accepted for back-compat but the copy is
// now always continuation-framed.
//
// Rendered as an OVERLAY over the real app (not a full-page replacement): the user
// has genuinely logged into their account - sidebar, history and drafts sit behind this.
// The card is DISMISSIBLE (per-tab): browsing the app stays open, but every metered
// action is still enforced server-side (402) and reopens the plans via UpgradeModal -
// closing this never grants usage, it only postpones the ask.
const PAID_PLANS = PLANS.filter((p) => p.id === 'starter' || p.id === 'pro')

const DISMISS_KEY = 'trial_gate_dismissed'

export function TrialGate({ name }: { name?: string; trialUsed?: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<BillingMode>('monthly')
  const [dismissed, setDismissed] = useState(false)

  // Per-tab memory so the card doesn't re-pop on every navigation once closed.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true)
    } catch {}
  }, [])

  function dismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {}
  }

  if (dismissed) return null

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-black/80 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="fixed right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[22px]">close</span>
      </button>
      {/* min-h-full + justify-center centers the card when it fits and lets it scroll when
          it doesn't (short viewports), instead of clipping the top. */}
      <div className="flex min-h-full flex-col items-center justify-center px-margin-mobile py-12 text-center">
        <h1 className="font-headline-xl text-headline-xl">
          Keep posting in your voice{name ? `, ${name}` : ''}
        </h1>
        <p className="mt-3 max-w-xl font-body-md text-body-md text-on-surface-variant">
          Your free trial credits are used up. Pick a plan to keep going - your voice, drafts, and
          history are all saved, so you pick up right where you left off.
        </p>

        <div className="mt-8">
          <Toggle mode={mode} setMode={setMode} />
        </div>

        <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-8 md:grid-cols-2">
          {PAID_PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} mode={mode} />
          ))}
        </div>

        <p className="mt-6 font-code-label text-code-label text-on-surface-variant/60">
          billed today · cancel anytime
        </p>

        <button
          type="button"
          onClick={signOut}
          className="mt-8 inline-flex items-center gap-1.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">logout</span>
          Log out
        </button>
      </div>
    </div>
  )
}
