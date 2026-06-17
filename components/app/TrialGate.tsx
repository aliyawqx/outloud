'use client'

import { useState } from 'react'
import { startCheckout } from '@/lib/billing/client'
import { STARTER_PRICE, PRO_PRICE } from '@/lib/pricing'
import { PLAN_ALLOWANCE } from '@/lib/creditsConfig'
import { Spinner } from '@/components/Spinner'

// Shown after signup/verify and BEFORE voice capture: pick a plan + add a card to
// start the 7-day free trial. Card collection + the trial happen in Polar's hosted
// checkout (products configured with trial_period_days). Card is charged at day 7
// unless cancelled. Gated behind TRIAL_GATE so it can be enabled when Polar is ready.
type PlanId = 'starter' | 'pro'

const OPTIONS: { id: PlanId; name: string; price: number; highlight?: boolean }[] = [
  { id: 'starter', name: 'Starter', price: STARTER_PRICE },
  { id: 'pro', name: 'Pro', price: PRO_PRICE, highlight: true },
]

export function TrialGate({ name, trialUsed = false }: { name?: string; trialUsed?: boolean }) {
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [error, setError] = useState('')

  async function start(plan: PlanId) {
    setError('')
    setBusy(plan)
    try {
      await startCheckout(plan, 'monthly') // redirects to Polar's hosted checkout
    } catch (e) {
      setError((e as Error).message || "Couldn't start the trial. Try again.")
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-margin-mobile py-12 text-center">
      <h1 className="font-headline-xl text-headline-xl">
        {trialUsed ? `Pick a plan to continue${name ? `, ${name}` : ''}` : `Start your 7-day free trial${name ? `, ${name}` : ''}`}
      </h1>
      <p className="mt-3 max-w-md font-body-md text-body-md text-on-surface-variant">
        {trialUsed ? (
          <>You've already used your free trial. Pick a plan to keep posting — you'll be billed today.</>
        ) : (
          <>Pick a plan and add your card. You get <span className="text-on-surface">{PLAN_ALLOWANCE.free.toLocaleString()} credits free for 7 days</span> — cancel anytime before day 7 and you won't be charged.</>
        )}
      </p>

      <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <div
            key={o.id}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-6 ${
              o.highlight ? 'border-electric-indigo' : 'border-border-muted'
            } bg-surface-container-low`}
          >
            <span className="font-headline-sm text-headline-sm text-on-surface">{o.name}</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {PLAN_ALLOWANCE[o.id].toLocaleString()} credits / mo
            </span>
            <span className="mt-1 font-code-label text-code-label text-on-surface-variant">
              ${o.price}/mo after trial
            </span>
            <button
              type="button"
              onClick={() => start(o.id)}
              disabled={busy !== null}
              className={`mt-3 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-60 ${
                o.highlight ? 'bg-electric-indigo hover:bg-primary-container' : 'bg-surface-container-high hover:brightness-110'
              }`}
            >
              {busy === o.id ? <Spinner size={16} /> : null}
              {trialUsed ? 'Subscribe' : 'Start free trial'}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 font-body-sm text-body-sm text-error">{error}</p>}
      <p className="mt-6 font-code-label text-code-label text-on-surface-variant/60">
        {trialUsed ? 'billed today · cancel anytime' : '$0 today · card required · cancel anytime before day 7'}
      </p>
    </div>
  )
}
