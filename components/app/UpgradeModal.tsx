'use client'

import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { PLANS, PRO_PRICE, STARTER_PRICE } from '@/lib/pricing'
import { startCheckout } from '@/lib/billing/client'

const PRO_PLAN = PLANS.find((p) => p.id === 'pro')
const STARTER_PLAN = PLANS.find((p) => p.id === 'starter')

// Full-screen subscribe wall, shown when a trial user runs out of credits (New Post and
// New Reply both use it). Pro is the default; a small switcher drops to the cheaper
// Starter. Checkout is a hosted Merchant-of-Record link.
export function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [plan, setPlan] = useState<'pro' | 'starter'>('pro')
  const [busy, setBusy] = useState(false)
  const isPro = plan === 'pro'
  const price = isPro ? PRO_PRICE : STARTER_PRICE
  const features = (isPro ? PRO_PLAN : STARTER_PLAN)?.features ?? []

  async function subscribe() {
    setBusy(true)
    try {
      await startCheckout(plan)
    } catch {
      setBusy(false)
    }
  }

  const pill = (active: boolean) =>
    `rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors ${
      active ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'
    }`

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8">
      {/* the app stays visible behind, blurred */}
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 backdrop-blur-[4px]" />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col items-center gap-6 overflow-y-auto rounded-3xl border border-border-muted bg-surface px-6 py-10 text-center shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/10 hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined">close</span>
        </button>

        <span className="rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-3 py-1 font-code-label text-code-label uppercase tracking-widest text-cyber-lime">
          You’re out of credits
        </span>
        <h2 className="font-headline-xl text-headline-xl">Do you want to subscribe?</h2>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Keep writing posts in your own voice. Pick a plan and pick up right where you left off.
        </p>

        {/* plan switcher - Pro is the default, switch down to Starter */}
        <div className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-surface-container-low p-1">
          <button type="button" className={pill(isPro)} onClick={() => setPlan('pro')}>
            Max · ${PRO_PRICE}/mo
          </button>
          <button type="button" className={pill(!isPro)} onClick={() => setPlan('starter')}>
            Pro · ${STARTER_PRICE}/mo
          </button>
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-electric-indigo bg-surface-container-low p-7 text-left indigo-glow">
          <div className="mb-1 flex items-end gap-1">
            <span className="font-headline-xl text-headline-xl leading-none">${price}</span>
            <span className="mb-1 font-body-md text-body-md text-on-surface-variant">/mo</span>
          </div>
          <p className="mb-5 font-code-label text-code-label text-on-surface-variant">
            {isPro ? 'Max - everything, unlimited' : 'Pro - for solo builders'}
          </p>
          <ul className="mb-6 space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface">
                <span className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={subscribe}
            disabled={busy}
            className="indigo-glow flex w-full items-center justify-center gap-2 rounded-full bg-electric-indigo px-6 py-3.5 text-lg font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {busy ? <><Spinner size={20} /> Starting…</> : `Subscribe · $${price}/mo`}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
