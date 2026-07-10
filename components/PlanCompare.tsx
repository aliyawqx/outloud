'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  COST_PER_AI_PHOTO,
  COST_PER_PHOTO_SEARCH,
  COST_PER_POST,
  COST_PER_REPLY,
  COST_PER_TOPIC_SEARCH,
  PLAN_ALLOWANCE,
  fmtCredits,
} from '@/lib/creditsConfig'
import { PLANS, type BillingMode } from '@/lib/pricing'
import { startCheckout } from '@/lib/billing/client'
import { Spinner } from '@/components/Spinner'

// "Compare features" (Higgsfield pattern): plan header with prices + Get Plan
// CTAs and an annual toggle, then the detail rows - collapsed by default with a
// fade-out and a centered expand button. Numbers derive from the ONE credits
// config, so a price change updates this table.

const COLS = [
  { id: 'trial', name: 'Free trial', allowance: PLAN_ALLOWANCE.free, per: 'total', highlight: false },
  { id: 'starter', name: 'Starter', allowance: PLAN_ALLOWANCE.starter, per: 'per month', highlight: false },
  { id: 'pro', name: 'Pro', allowance: PLAN_ALLOWANCE.pro, per: 'per month', highlight: true },
] as const

const ACTIONS = [
  { label: 'Posts written in your voice', cost: COST_PER_POST },
  { label: 'Replies to other people’s posts', cost: COST_PER_REPLY },
  { label: 'AI-generated images for your posts', cost: COST_PER_AI_PHOTO },
  { label: 'Topic scans that find posts worth replying to', cost: COST_PER_TOPIC_SEARCH },
  { label: 'Stock photos matched to your posts', cost: COST_PER_PHOTO_SEARCH },
] as const

// true = included; per-plan flags in column order: trial / starter / pro.
const FEATURES: { label: string; on: [boolean, boolean, boolean] }[] = [
  { label: 'Voice capture from your posts', on: [true, true, true] },
  { label: 'Publish to X, LinkedIn & Threads', on: [true, true, true] },
  { label: 'X Reply engine', on: [true, true, true] },
  { label: 'Scheduling calendar', on: [true, true, true] },
  { label: 'Credit top-ups', on: [false, true, true] },
  { label: 'Autopilot - zero-touch posting', on: [false, false, true] },
  { label: 'Trending discovery', on: [false, false, true] },
  { label: 'Style presets + hook intensity', on: [false, false, true] },
  { label: 'Multiple accounts per platform', on: [false, false, true] },
  { label: 'Priority generation', on: [false, false, true] },
]

const check = (on: boolean) =>
  on ? (
    <span aria-label="Included" className="material-symbols-outlined text-[20px] text-cyber-lime">check</span>
  ) : (
    <span aria-label="Not included" className="material-symbols-outlined text-[20px] text-on-surface-variant/30">close</span>
  )

function PlanCta({ id, mode }: { id: string; mode: BillingMode }) {
  const [busy, setBusy] = useState(false)
  if (id === 'trial') {
    return (
      <Link
        href="/signup"
        className="mt-3 inline-block w-full max-w-44 rounded-full border border-border-muted px-5 py-2.5 text-center font-body-sm text-body-sm font-bold text-on-surface transition-colors hover:border-electric-indigo"
      >
        Start free
      </Link>
    )
  }
  const pro = id === 'pro'
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        startCheckout(id as 'pro' | 'starter', mode).catch(() => setBusy(false))
      }}
      className={`mt-3 inline-flex w-full max-w-44 items-center justify-center gap-2 rounded-full px-5 py-2.5 font-body-sm text-body-sm font-bold transition-all active:scale-95 disabled:opacity-60 ${
        pro
          ? 'bg-cyber-lime text-charcoal-black hover:brightness-110'
          : 'border border-border-muted text-on-surface hover:border-electric-indigo'
      }`}
    >
      {busy ? <Spinner size={14} /> : null}
      Get Plan
    </button>
  )
}

export function PlanCompare() {
  const [mode, setMode] = useState<BillingMode>('annual')
  const [expanded, setExpanded] = useState(false)
  const annual = mode === 'annual'

  const priceLine = (id: string) => {
    if (id === 'trial') return { price: 'Free', sub: '3 days · no card' }
    const p = PLANS.find((x) => x.id === id)!
    return {
      price: `$${annual ? p.annual.perMo : p.monthly.perMo}/month`,
      sub: annual ? 'Billed annually' : 'Billed monthly',
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-margin-mobile py-16 md:px-margin-desktop">
      <div className="reveal mb-8 text-center">
        <div className="mb-3 inline-block border-b border-cyber-lime/30 pb-1 font-code-label text-code-label text-cyber-lime">
          0x03 // COMPARE
        </div>
        <h2 className="mb-3 font-headline-xl text-headline-lg md:text-headline-xl">Compare features</h2>
        <p className="font-body-md text-lg text-on-surface-variant">See in detail what each plan gets you.</p>
      </div>

      <div className="reveal relative">
        <div className={expanded ? '' : 'relative max-h-[680px] overflow-hidden'}>
          <div className="overflow-x-auto rounded-3xl border border-border-muted bg-surface-container-lowest/60">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-muted">
                  {/* annual toggle lives where the row-label column starts */}
                  <th className="w-1/3 p-5 align-bottom">
                    <div className="inline-flex items-center gap-2.5 rounded-full border border-border-muted px-4 py-2.5">
                      <span className={`font-body-sm text-body-sm ${annual ? 'font-bold text-cyber-lime' : 'text-on-surface-variant'}`}>
                        Annual <span className="font-bold">33% OFF</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={annual}
                        aria-label="Bill annually"
                        onClick={() => setMode(annual ? 'monthly' : 'annual')}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${annual ? 'bg-cyber-lime' : 'bg-surface-container-highest'}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${annual ? 'left-[22px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </th>
                  {COLS.map((c) => {
                    const { price, sub } = priceLine(c.id)
                    return (
                      <th key={c.id} className="p-5 align-top">
                        <span className="flex items-center gap-2">
                          <span className={`font-headline-lg text-2xl font-bold ${c.highlight ? 'text-on-surface' : 'text-on-surface'}`}>
                            {c.name}
                          </span>
                          {c.highlight && (
                            <span className="rounded-md bg-electric-indigo px-2 py-0.5 font-code-label text-[10px] font-bold uppercase text-white">
                              Best value
                            </span>
                          )}
                        </span>
                        <span className="mt-2 block font-body-md text-body-md text-on-surface">{price}</span>
                        <span className="block font-body-sm text-body-sm text-on-surface-variant">{sub}</span>
                        <span className="mt-1 block font-body-sm text-body-sm font-bold text-cyber-lime">
                          {fmtCredits(c.allowance)} credits {c.per === 'total' ? 'to start' : '/ mo'}
                        </span>
                        <PlanCta id={c.id} mode={mode} />
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="px-5 pb-2 pt-6 font-headline-lg text-xl font-bold text-on-surface">
                    What your credits buy
                  </td>
                </tr>
                {ACTIONS.map((a) => (
                  <tr key={a.label} className="border-b border-border-muted/60 transition-colors last:border-b-0 hover:bg-white/[0.03]">
                    <td className="p-5">
                      <span className="block font-body-md text-body-md text-on-surface">{a.label}</span>
                      <span className="block font-body-sm text-body-sm text-on-surface-variant/60">
                        {fmtCredits(a.cost)} credits each
                      </span>
                    </td>
                    {COLS.map((c) => (
                      <td key={c.id} className="p-5 font-body-md text-body-md tabular-nums">
                        <span className={`font-bold ${c.highlight ? 'text-cyber-lime' : 'text-on-surface'}`}>
                          {Math.floor(c.allowance / a.cost).toLocaleString()}
                        </span>
                        <span className="ml-1.5 font-body-sm text-body-sm text-on-surface-variant/60">
                          {c.per === 'total' ? 'total' : '/ mo'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="px-5 pb-2 pt-8 font-headline-lg text-xl font-bold text-on-surface">
                    Features
                  </td>
                </tr>
                {FEATURES.map((f) => (
                  <tr key={f.label} className="border-b border-border-muted/60 transition-colors last:border-b-0 hover:bg-white/[0.03]">
                    <td className="p-5 font-body-md text-body-md text-on-surface">{f.label}</td>
                    {COLS.map((c, i) => (
                      <td key={c.id} className="p-5">{check(f.on[i])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* fade-out over the clipped rows while collapsed */}
          {!expanded && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-charcoal-black to-transparent" />
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-border-muted px-8 py-3 font-body-md text-body-md font-bold text-on-surface transition-colors hover:border-electric-indigo"
          >
            {expanded ? 'Show less' : 'Compare features'}
          </button>
        </div>
      </div>

      <p className="reveal mt-4 text-center font-code-label text-code-label text-on-surface-variant/60">
        Credits are one shared pool - mix actions however you like.
      </p>
    </section>
  )
}
