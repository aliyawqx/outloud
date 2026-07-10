'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PLANS, ANNUAL_BADGE, PRICING_NOTE, type BillingMode, type Plan } from '@/lib/pricing'
import { startCheckout } from '@/lib/billing/client'
import { Spinner } from '@/components/Spinner'
// Single source of truth - keep marketing copy in sync with real costs/allowances.
import { COST_PER_POST, COST_PER_REPLY, PLAN_ALLOWANCE, fmtCredits } from '@/lib/creditsConfig'

// Per-plan monthly credit allowance shown on the cards (paid plans only here).
const PLAN_CREDITS: Record<string, number> = {
  starter: PLAN_ALLOWANCE.starter,
  pro: PLAN_ALLOWANCE.pro,
}

export function Toggle({ mode, setMode }: { mode: BillingMode; setMode: (m: BillingMode) => void }) {
  const pill = (active: boolean) =>
    `rounded-full px-6 py-2 font-body-sm text-body-sm font-bold transition-colors ${
      active ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'
    }`
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-surface-container-low p-1">
        <button type="button" className={pill(mode === 'monthly')} onClick={() => setMode('monthly')}>
          Monthly
        </button>
        <button type="button" className={pill(mode === 'annual')} onClick={() => setMode('annual')}>
          Annual
        </button>
      </div>
      <span className="rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-3 py-1 font-code-label text-code-label text-cyber-lime">
        {ANNUAL_BADGE}
      </span>
    </div>
  )
}

export function PlanCard({ plan, mode, current = false }: { plan: Plan; mode: BillingMode; current?: boolean }) {
  const annual = mode === 'annual'
  const price = annual ? plan.annual.perMo : plan.monthly.perMo
  const sub = annual ? plan.annual.sub : plan.monthly.sub

  const saveLine = plan.trial ? '' : annual ? plan.annual.save : plan.annual.save ? `${plan.annual.save} with annual` : ''
  const paidPlan = plan.id === 'pro' || plan.id === 'starter'
  const credits = PLAN_CREDITS[plan.id] // when set, show the credit display instead of features
  const [busy, setBusy] = useState(false)
  const ctaClass = `rounded-full px-6 py-3 text-center font-bold transition-all active:scale-95 ${
    plan.highlight
      ? 'indigo-glow bg-electric-indigo text-white'
      : 'border border-border-muted text-on-surface hover:border-electric-indigo'
  }`

  return (
    <div
      className={`glass-card indigo-glow relative flex flex-col rounded-3xl p-8 transition-all hover:-translate-y-1.5 ${
        plan.highlight
          ? 'border-electric-indigo shadow-[0_0_50px_-12px] shadow-electric-indigo/50 md:scale-[1.04]'
          : 'hover:border-electric-indigo/40'
      }`}
    >
      {/* "Current plan" (for a signed-in visitor) beats the marketing badge. */}
      {current ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyber-lime px-3 py-1 font-code-label text-code-label font-bold uppercase text-charcoal-black">
          Current plan
        </span>
      ) : plan.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-electric-indigo px-3 py-1 font-code-label text-code-label font-bold text-white">
          {plan.badge}
        </span>
      ) : null}

      <h3 className="font-headline-lg text-headline-lg">{plan.name}</h3>
      <p className="mt-2 mb-6 font-body-sm text-body-sm text-on-surface-variant">{plan.tagline}</p>

      <div className="mb-1 flex items-end gap-1.5">
        {plan.trial ? (
          <span className="font-headline-xl text-headline-xl leading-none">Free</span>
        ) : (
          <>
            {/* Struck-through anchor before the real price: annual anchors on the
                monthly price, monthly on its own "was" anchor. */}
            {(annual ? plan.monthly.perMo : plan.monthly.anchor) != null && (annual || plan.monthly.anchor) && (
              <span className="font-headline-xl text-2xl leading-none text-error line-through decoration-2">
                ${annual ? plan.monthly.perMo : plan.monthly.anchor}
              </span>
            )}
            <span className="font-headline-xl text-headline-xl leading-none">${price}</span>
            <span className="mb-1 font-body-md text-body-md text-on-surface-variant">/mo</span>
          </>
        )}
      </div>
      <div className="font-body-sm text-body-sm text-on-surface-variant">{sub}</div>
      <div className="mt-1 min-h-[1.25rem] font-code-label text-code-label text-secondary">{saveLine}</div>

      {credits ? (
        // Credit-based display: total monthly credits + an approximate breakdown,
        // then the plan's perks listed like the free plan.
        <div className="my-8 flex-1">
          <div className="font-headline-lg text-2xl font-bold text-on-surface">{fmtCredits(credits)} credits / mo</div>
          <div className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant">
            ≈ {Math.floor(credits / COST_PER_POST)} posts or {Math.floor(credits / COST_PER_REPLY)} replies
          </div>
          <ul className="mt-6 space-y-3 border-t border-border-muted pt-6">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-left font-body-sm text-body-sm text-on-surface">
                <span className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="my-8 flex-1 space-y-3">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-left font-body-sm text-body-sm text-on-surface">
              <span className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      {current ? (
        <span className="rounded-full border border-cyber-lime/50 px-6 py-3 text-center font-bold text-cyber-lime">
          Your current plan
        </span>
      ) : paidPlan ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            startCheckout(plan.id as 'pro' | 'starter', mode).catch(() => setBusy(false))
          }}
          className={`flex items-center justify-center gap-2 disabled:opacity-60 ${ctaClass}`}
        >
          {busy ? <><Spinner size={18} /> Starting…</> : plan.cta}
        </button>
      ) : (
        <Link href={plan.href ?? '/signup'} className={ctaClass}>
          {plan.cta}
        </Link>
      )}
    </div>
  )
}

export function Pricing({ condensed = false, currentPlan = null }: { condensed?: boolean; currentPlan?: string | null }) {
  const [mode, setMode] = useState<BillingMode>('annual')

  // Show every plan (free trial first) on both the home and the full pricing page.
  const plans = PLANS
  const cols = plans.length >= 3 ? 'md:grid-cols-3 max-w-5xl' : 'md:grid-cols-2 max-w-3xl'

  return (
    <section id="pricing" className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="reveal mb-10 text-center">
        <div className="mb-3 inline-block border-b border-cyber-lime/30 pb-1 font-code-label text-code-label text-cyber-lime">
          0x02 // PRICING
        </div>
        <h2 className="mb-4 font-headline-xl text-headline-lg md:text-headline-xl">
          Write it yourself, or let it run.
        </h2>
        <p className="mx-auto mb-8 max-w-2xl font-body-md text-lg text-on-surface-variant">
          Start free for 3 days - with autopilot switched on, so you can watch it work.
        </p>
        <Toggle mode={mode} setMode={setMode} />
      </div>

      <div className={`reveal mx-auto grid grid-cols-1 gap-8 ${cols}`} style={{ transitionDelay: '100ms' }}>
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} mode={mode} current={p.id === currentPlan} />
        ))}
      </div>

      <p className="reveal mx-auto mt-6 max-w-xl text-center font-body-sm text-body-sm text-on-surface-variant/70">
        Credits are shared across actions. Post ≈ {fmtCredits(COST_PER_POST)} cr · Reply ≈ {fmtCredits(COST_PER_REPLY)} cr.
      </p>

      <p className="reveal mx-auto mt-3 max-w-xl text-center font-code-label text-code-label text-on-surface-variant">
        {PRICING_NOTE}
      </p>

      {condensed && (
        <div className="reveal mt-8 text-center">
          <Link
            href="/pricing"
            className="indigo-glow group inline-flex items-center gap-2 rounded-full bg-electric-indigo px-8 py-3.5 font-body-md text-body-md font-bold text-white transition-all hover:bg-primary-container active:scale-95"
          >
            More details about pricing
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">arrow_forward</span>
          </Link>
        </div>
      )}
    </section>
  )
}
