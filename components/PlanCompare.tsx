'use client'

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

// "Compare features" (Higgsfield pattern): the same three plans as the cards
// above, but concrete - every metered action with its credit cost and how many
// of it each plan affords, then the feature checklist. Pure/static: numbers are
// derived from the ONE credits config, so a price change updates this table.

const COLS = [
  { id: 'trial', name: 'Free trial', priceLine: 'Free · 3 days', allowance: PLAN_ALLOWANCE.free, per: 'total', highlight: false },
  { id: 'starter', name: 'Starter', priceLine: '$15/mo', allowance: PLAN_ALLOWANCE.starter, per: 'per month', highlight: false },
  { id: 'pro', name: 'Pro', priceLine: '$39/mo', allowance: PLAN_ALLOWANCE.pro, per: 'per month', highlight: true },
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
    <span aria-label="Included" className="material-symbols-outlined text-[18px] text-cyber-lime">check_circle</span>
  ) : (
    <span aria-label="Not included" className="material-symbols-outlined text-[18px] text-on-surface-variant/30">remove</span>
  )

export function PlanCompare() {
  // Collapsed by default: header + the credits rows peek out, the rest fades -
  // "Show more" reveals the full table.
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="mx-auto max-w-5xl px-margin-mobile py-16 md:px-margin-desktop">
      <div className="reveal mb-8 text-center">
        <div className="mb-3 inline-block border-b border-cyber-lime/30 pb-1 font-code-label text-code-label text-cyber-lime">
          0x03 // COMPARE
        </div>
        <h2 className="mb-3 font-headline-xl text-headline-lg md:text-headline-xl">Compare features</h2>
        <p className="font-body-md text-lg text-on-surface-variant">See in detail what each plan gets you.</p>
      </div>

      <div className={`reveal relative ${expanded ? '' : 'max-h-[560px] overflow-hidden'}`}>
      <div className="overflow-x-auto rounded-2xl border border-electric-indigo/30">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-electric-indigo/30 bg-surface-container-lowest">
              <th className="p-4 font-code-label text-code-label uppercase text-on-surface-variant/60">Plan</th>
              {COLS.map((c) => (
                <th key={c.id} className={`p-4 ${c.highlight ? 'border-t-2 border-t-electric-indigo bg-electric-indigo/15' : ''}`}>
                  <span className={`block font-headline-lg text-2xl font-bold ${c.highlight ? 'text-electric-indigo' : 'text-on-surface'}`}>
                    {c.name}
                  </span>
                  <span className="block font-body-sm text-body-sm text-on-surface-variant">{c.priceLine}</span>
                  <span className="block font-body-sm text-body-sm font-bold text-cyber-lime">
                    {fmtCredits(c.allowance)} credits {c.per === 'total' ? 'to start' : '/ mo'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border-muted bg-cyber-lime/[0.06]">
              <td colSpan={4} className="px-4 py-2.5 font-body-sm text-body-sm font-bold uppercase tracking-wide text-cyber-lime">
                What your credits buy
              </td>
            </tr>
            {ACTIONS.map((a) => (
              <tr key={a.label} className="border-b border-border-muted transition-colors hover:bg-white/[0.03]">
                <td className="p-4">
                  <span className="block font-body-md text-body-md text-on-surface">{a.label}</span>
                  <span className="block font-body-sm text-body-sm text-on-surface-variant/60">
                    {fmtCredits(a.cost)} credits each
                  </span>
                </td>
                {COLS.map((c) => (
                  <td key={c.id} className={`p-4 font-body-md text-body-md tabular-nums ${c.highlight ? 'bg-electric-indigo/15' : ''}`}>
                    <span className={`font-bold ${c.highlight ? 'text-electric-indigo' : 'text-on-surface'}`}>
                      {Math.floor(c.allowance / a.cost).toLocaleString()}
                    </span>
                    <span className="ml-1.5 font-body-sm text-body-sm text-on-surface-variant/60">
                      {c.per === 'total' ? 'total' : '/ mo'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-b border-border-muted bg-cyber-lime/[0.06]">
              <td colSpan={4} className="px-4 py-2.5 font-body-sm text-body-sm font-bold uppercase tracking-wide text-cyber-lime">
                Features
              </td>
            </tr>
            {FEATURES.map((f) => (
              <tr key={f.label} className="border-b border-border-muted transition-colors last:border-b-0 hover:bg-white/[0.03]">
                <td className="p-4 font-body-md text-body-md text-on-surface">{f.label}</td>
                {COLS.map((c, i) => (
                  <td key={c.id} className={`p-4 ${c.highlight ? 'bg-electric-indigo/15' : ''}`}>{check(f.on[i])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!expanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-charcoal-black to-transparent" />
      )}
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full border border-border-muted px-8 py-3 font-body-md text-body-md font-bold text-on-surface transition-colors hover:border-electric-indigo"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      </div>

      <p className="reveal mt-4 text-center font-code-label text-code-label text-on-surface-variant/60">
        Credits are one shared pool - mix actions however you like.
      </p>
    </section>
  )
}
