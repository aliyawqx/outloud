'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  COST_PER_AI_PHOTO,
  COST_PER_POST,
  COST_PER_REPLY,
  COST_PER_TOPIC_SEARCH,
  PLAN_ALLOWANCE,
  fmtCredits,
} from '@/lib/creditsConfig'
import { PLANS } from '@/lib/pricing'

// "Find the best plan for you" (Higgsfield pattern): pick what you make, dial in
// monthly volume, get a live recommendation with expected usage vs the plan's
// allowance. Pure client math over the ONE credits config - no API calls.

type UseKey = 'posts' | 'replies' | 'images' | 'topics'

const USES: { key: UseKey; label: string; cost: number; unit: string; default: number; max: number; step: number }[] = [
  { key: 'posts', label: 'Posts in my voice', cost: COST_PER_POST, unit: 'posts / mo', default: 20, max: 300, step: 5 },
  { key: 'replies', label: 'Replies to grow reach', cost: COST_PER_REPLY, unit: 'replies / mo', default: 30, max: 200, step: 5 },
  { key: 'images', label: 'AI images on posts', cost: COST_PER_AI_PHOTO, unit: 'images / mo', default: 10, max: 300, step: 5 },
  { key: 'topics', label: 'Topic research', cost: COST_PER_TOPIC_SEARCH, unit: 'searches / mo', default: 4, max: 60, step: 1 },
]

export function PlanFinder() {
  // Defaults deliberately land on Pro: autopilot pre-selected (the flagship) plus
  // a realistic posts+replies volume - the visitor starts from the recommended
  // plan and dials DOWN, not up (Higgsfield does the same with Plus).
  const [selected, setSelected] = useState<UseKey[]>(['posts', 'replies'])
  const [autopilot, setAutopilot] = useState(true)
  const [counts, setCounts] = useState<Record<UseKey, number>>({
    posts: 30,
    replies: 40,
    images: 10,
    topics: 4,
  })

  const toggle = (k: UseKey) =>
    setSelected((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))

  const needed = useMemo(
    () => USES.reduce((sum, u) => (selected.includes(u.key) ? sum + counts[u.key] * u.cost : sum), 0),
    [selected, counts],
  )

  // Autopilot is Pro-only; otherwise the smallest plan whose allowance covers the need.
  const planId = autopilot || needed > PLAN_ALLOWANCE.starter ? 'pro' : 'starter'
  const plan = PLANS.find((p) => p.id === planId)!
  const allowance = PLAN_ALLOWANCE[planId]
  const overflow = needed > allowance
  const usagePct = Math.min(100, Math.round((needed / allowance) * 100))

  const stepper = (u: (typeof USES)[number]) => (
    <div key={u.key} className="flex items-center justify-between gap-3 rounded-xl border border-border-muted bg-surface-container-lowest px-4 py-3">
      <div className="min-w-0">
        <p className="font-body-md text-body-md text-on-surface">{u.label}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant/60">≈ {fmtCredits(u.cost)} credits each</p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          aria-label={`Fewer ${u.unit}`}
          onClick={() => setCounts((c) => ({ ...c, [u.key]: Math.max(0, c[u.key] - u.step) }))}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border-muted text-on-surface-variant transition-colors hover:border-electric-indigo/60 hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">remove</span>
        </button>
        <span className="w-20 text-center">
          <span className="block font-body-md text-body-md font-bold tabular-nums text-on-surface">{counts[u.key]}</span>
          <span className="block font-code-label text-[10px] text-on-surface-variant/60">{u.unit}</span>
        </span>
        <button
          type="button"
          aria-label={`More ${u.unit}`}
          onClick={() => setCounts((c) => ({ ...c, [u.key]: Math.min(u.max, c[u.key] + u.step) }))}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border-muted text-on-surface-variant transition-colors hover:border-electric-indigo/60 hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </div>
    </div>
  )

  return (
    <section className="mx-auto max-w-5xl px-margin-mobile py-16 md:px-margin-desktop">
      <div className="reveal mb-8 text-center">
        <h2 className="mb-2 font-headline-lg text-headline-lg">Find the best plan for you</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Choose what you want to create and see exactly what you need.
        </p>
      </div>

      {/* ONE containing card so the questions read as part of the same widget as
          the recommendation - two boxes inside one frame. */}
      <div className="reveal rounded-3xl border border-border-muted bg-surface-container-low p-4 sm:p-6">
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8 rounded-2xl border border-border-muted bg-surface-container-lowest p-5 sm:p-6">
          {/* 1 - what they make */}
          <div>
            <p className="mb-4 flex items-center gap-2.5 font-body-md text-body-md font-bold text-on-surface">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-electric-indigo text-[13px] font-bold text-white">1</span>
              What are you here to make? <span className="font-normal text-on-surface-variant/60">(pick any)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {USES.map((u) => {
                const on = selected.includes(u.key)
                return (
                  <button
                    key={u.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(u.key)}
                    className={`rounded-full border px-5 py-2.5 font-body-sm text-body-sm transition-colors ${
                      on ? 'border-electric-indigo bg-electric-indigo/15 font-bold text-on-surface' : 'border-border-muted text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {u.label}
                  </button>
                )
              })}
              <button
                type="button"
                role="checkbox"
                aria-checked={autopilot}
                onClick={() => setAutopilot((v) => !v)}
                className={`rounded-full border px-5 py-2.5 font-body-sm text-body-sm transition-colors ${
                  autopilot ? 'border-cyber-lime bg-cyber-lime/10 font-bold text-cyber-lime' : 'border-border-muted text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Hands-off autopilot
              </button>
            </div>
          </div>

          {/* 2 - how much */}
          {selected.length > 0 && (
            <div>
              <p className="mb-4 flex items-center gap-2.5 font-body-md text-body-md font-bold text-on-surface">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-electric-indigo text-[13px] font-bold text-white">2</span>
                How much per month?
              </p>
              <div className="flex flex-col gap-2">{USES.filter((u) => selected.includes(u.key)).map(stepper)}</div>
            </div>
          )}
        </div>

        {/* live recommendation */}
        <div className="rounded-2xl border border-electric-indigo bg-surface-container-lowest p-6 indigo-glow lg:sticky lg:top-6">
          <p className="font-code-label text-code-label uppercase tracking-widest text-electric-indigo">We recommend</p>
          <p className="mt-1.5 font-headline-xl text-headline-lg md:text-headline-xl">{plan.name}</p>
          <p className="mt-1.5 font-body-md text-body-md text-on-surface-variant">{plan.tagline}</p>

          <div className="mt-6">
            <div className="flex items-baseline justify-between font-body-sm text-body-sm text-on-surface-variant">
              <span>Expected monthly usage</span>
              <span className="font-bold tabular-nums text-on-surface">
                {fmtCredits(needed)} / {fmtCredits(allowance)}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className={`h-full rounded-full ${overflow ? 'bg-error' : 'bg-electric-indigo'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {autopilot && (
              <p className="mt-2.5 font-body-sm text-body-sm font-bold text-cyber-lime">autopilot needs Pro</p>
            )}
            {overflow && (
              <p className="mt-2.5 font-body-sm text-body-sm text-on-surface-variant">
                that&apos;s more than the plan includes - add a credit top-up when you run low.
              </p>
            )}
          </div>

          <div className="mt-6 flex items-end gap-2">
            <span className="font-headline-xl text-headline-xl leading-none">${plan.annual.perMo}</span>
            <span className="mb-1 font-body-md text-body-md text-on-surface-variant">/mo billed annually · ${plan.monthly.perMo} monthly</span>
          </div>

          <Link
            href="#pricing"
            className="mt-5 block rounded-full bg-electric-indigo px-6 py-3 text-center font-bold text-white transition-all hover:bg-primary-container active:scale-95"
          >
            Get {plan.name}
          </Link>
        </div>
        </div>
      </div>
    </section>
  )
}
