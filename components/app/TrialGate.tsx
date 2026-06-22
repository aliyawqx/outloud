'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS, type BillingMode } from '@/lib/pricing'
import { PLAN_ALLOWANCE, fmtCredits } from '@/lib/creditsConfig'
import { PlanCard, Toggle } from '@/components/Pricing'

// Shown after signup/verify, before the app: pick a plan to start. NEW users get a
// 7-day Polar trial (card required, auto-bills day 7); users who already used their
// free window are billed immediately (handled server-side via allow_trial=false).
// Uses the same plan cards as the landing pricing section.
const PAID_PLANS = PLANS.filter((p) => p.id === 'starter' || p.id === 'pro')

export function TrialGate({ name, trialUsed = false }: { name?: string; trialUsed?: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<BillingMode>('monthly')

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-margin-mobile py-12 text-center">
      <div className="mb-3 inline-block border-b border-cyber-lime/30 pb-1 font-code-label text-code-label text-cyber-lime">
        0x02 // PRICING
      </div>
      <h1 className="font-headline-xl text-headline-xl">
        {trialUsed ? `Pick a plan to continue${name ? `, ${name}` : ''}` : `Start your 7-day free trial${name ? `, ${name}` : ''}`}
      </h1>
      <p className="mt-3 max-w-xl font-body-md text-body-md text-on-surface-variant">
        {trialUsed ? (
          <>You&apos;ve used your free window. Pick a plan to keep posting — you&apos;ll be billed today.</>
        ) : (
          <>
            Pick a plan and add your card. You get{' '}
            <span className="text-on-surface">{fmtCredits(PLAN_ALLOWANCE.free)} credits free for 7 days</span> — cancel anytime
            before day 7 and you won&apos;t be charged.
          </>
        )}
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
        {trialUsed ? 'billed today · cancel anytime' : '$0 today · card required · cancel anytime before day 7'}
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
  )
}
