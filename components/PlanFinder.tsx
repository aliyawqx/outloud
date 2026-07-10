'use client'

import { useMemo, useState } from 'react'
import {
  COST_PER_AI_PHOTO,
  COST_PER_POST,
  COST_PER_REPLY,
  COST_PER_TOPIC_SEARCH,
  PLAN_ALLOWANCE,
  fmtCredits,
} from '@/lib/creditsConfig'
import { PLANS, type BillingMode } from '@/lib/pricing'
import { startCheckout } from '@/lib/billing/client'
import { Spinner } from '@/components/Spinner'

// "Find the best plan for you" (Higgsfield pattern): numbered steps down a rail
// on the left - checkbox option rows, then sliders for volume - and a live plan
// card on the right with expected usage, feature checklist, anchored price and
// a loud CTA. Pure client math over the ONE credits config.

type UseKey = 'posts' | 'replies' | 'images' | 'topics'

const USES: { key: UseKey; label: string; icon: string; cost: number; unit: string; max: number; step: number }[] = [
  { key: 'posts', label: 'Posts in my voice', icon: 'edit_square', cost: COST_PER_POST, unit: 'posts / mo', max: 300, step: 5 },
  { key: 'replies', label: 'Replies to grow reach', icon: 'reply', cost: COST_PER_REPLY, unit: 'replies / mo', max: 200, step: 5 },
  { key: 'images', label: 'AI images on posts', icon: 'image', cost: COST_PER_AI_PHOTO, unit: 'images / mo', max: 300, step: 5 },
  { key: 'topics', label: 'Topic research', icon: 'search', cost: COST_PER_TOPIC_SEARCH, unit: 'searches / mo', max: 60, step: 1 },
]

function StepHeading({ n, title, caption }: { n: number; title: string; caption?: string }) {
  return (
    <div className="mb-4">
      <p className="flex items-center gap-3 font-body-md text-body-md font-bold text-on-surface">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-code-label text-[13px] font-bold text-on-surface">
          {n}
        </span>
        {title}
      </p>
      {caption && <p className="ml-10 mt-1 font-body-sm text-body-sm text-on-surface-variant/70">{caption}</p>}
    </div>
  )
}

export function PlanFinder() {
  // Defaults deliberately land on Pro: autopilot pre-selected (the flagship) plus
  // a realistic posts+replies volume - the visitor starts from the recommended
  // plan and dials DOWN, not up (Higgsfield does the same with Plus).
  const [selected, setSelected] = useState<UseKey[]>(['posts', 'replies'])
  const [autopilot, setAutopilot] = useState(true)
  const [mode, setMode] = useState<BillingMode>('annual')
  const [busy, setBusy] = useState(false)
  const [counts, setCounts] = useState<Record<UseKey, number>>({
    posts: 135,
    replies: 50,
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
  const annual = mode === 'annual'
  const yearlySavings = (plan.monthly.perMo - plan.annual.perMo) * 12

  // Selection reads through the ACCENTED label + tick, never a tinted background -
  // the card itself stays neutral gray (Higgsfield pattern).
  const optionRow = (opts: { on: boolean; icon: string; label: string; accent?: 'lime'; onClick: () => void }) => (
    <button
      key={opts.label}
      type="button"
      role="checkbox"
      aria-checked={opts.on}
      onClick={opts.onClick}
      className="flex items-center gap-2.5 rounded-2xl border border-border-muted bg-surface-container-low px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span
        aria-hidden="true"
        className={`material-symbols-outlined text-[18px] ${
          opts.on ? (opts.accent === 'lime' ? 'text-cyber-lime' : 'text-electric-indigo') : 'text-on-surface-variant'
        }`}
      >
        {opts.icon}
      </span>
      <span
        className={`flex-1 truncate font-body-sm text-body-sm ${
          opts.on
            ? `font-bold ${opts.accent === 'lime' ? 'text-cyber-lime' : 'text-electric-indigo'}`
            : 'text-on-surface'
        }`}
      >
        {opts.label}
      </span>
      <span
        aria-hidden="true"
        className={`material-symbols-outlined text-[20px] ${
          opts.on ? (opts.accent === 'lime' ? 'text-cyber-lime' : 'text-electric-indigo') : 'text-on-surface-variant/40'
        }`}
      >
        {opts.on ? 'check_circle' : 'radio_button_unchecked'}
      </span>
    </button>
  )

  return (
    <section className="mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop">
      <div className="reveal mb-8 text-center">
        <h2 className="mb-2 font-headline-xl text-headline-lg md:text-headline-xl">Find the best plan for you</h2>
        <p className="font-body-md text-lg text-on-surface-variant">
          Choose what you want to create and see exactly what you need.
        </p>
      </div>

      {/* ONE containing card: questions down a step rail on the left, the live
          recommendation card on the right. */}
      <div className="reveal overflow-hidden rounded-3xl border border-border-muted bg-surface-container-lowest">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
          {/* left: steps */}
          <div className="flex flex-col gap-10 p-6 sm:p-10">
            {/* 1 - what they make */}
            <div className="relative">
              <StepHeading n={1} title="What are you here to make?" caption="Multiple options can be selected" />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {USES.map((u) =>
                  optionRow({
                    on: selected.includes(u.key),
                    icon: u.icon,
                    label: u.label,
                    onClick: () => toggle(u.key),
                  }),
                )}
                {optionRow({
                  on: autopilot,
                  icon: 'auto_awesome',
                  label: 'Hands-off autopilot',
                  accent: 'lime',
                  onClick: () => setAutopilot((v) => !v),
                })}
              </div>
            </div>

            {/* 2 - how much */}
            {selected.length > 0 && (
              <div>
                <StepHeading
                  n={2}
                  title="How much per month?"
                  caption={USES.filter((u) => selected.includes(u.key))
                    .map((u) => `≈ ${fmtCredits(u.cost)} credits each · per ${u.label.toLowerCase()}`)
                    .join('  ·  ')}
                />
                <div className="flex flex-col gap-7">
                  {USES.filter((u) => selected.includes(u.key)).map((u) => (
                    <div key={u.key}>
                      <input
                        type="range"
                        min={0}
                        max={u.max}
                        step={u.step}
                        value={counts[u.key]}
                        onChange={(e) => setCounts((c) => ({ ...c, [u.key]: Number(e.target.value) }))}
                        aria-label={`${u.label} per month`}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-cyber-lime"
                        style={{
                          // Filled track up to the thumb (cyber-lime #ADFF2F from the theme).
                          background: `linear-gradient(to right, #ADFF2F ${Math.round((counts[u.key] / u.max) * 100)}%, rgba(255,255,255,0.08) ${Math.round((counts[u.key] / u.max) * 100)}%)`,
                        }}
                      />
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="font-body-md text-body-md text-on-surface">
                          <span className="font-bold tabular-nums"># {counts[u.key]}</span>{' '}
                          <span className="text-on-surface-variant">{u.unit}</span>
                          <span className="ml-2 font-body-sm text-body-sm text-on-surface-variant/60">
                            {fmtCredits(counts[u.key] * u.cost)} credits
                          </span>
                        </span>
                        <span className="rounded-full border border-border-muted px-2.5 py-1 font-code-label text-code-label text-on-surface-variant">
                          {u.max}+
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* right: recommendation zone */}
          <div className="flex flex-col justify-between gap-6 border-t border-border-muted bg-surface-container-low p-6 sm:p-10 lg:border-l lg:border-t-0">
            <div>
              <p className="mb-5 text-center font-body-md text-lg text-on-surface-variant">
                We recommend <span className="font-bold text-on-surface">{plan.name} plan</span>
              </p>

              {/* the plan card itself */}
              <div className="rounded-3xl border border-cyber-lime/40 bg-surface-container-lowest p-6 shadow-[0_0_40px_-18px] shadow-cyber-lime/40">
                <div className="flex items-center gap-3">
                  <span className="font-headline-xl text-3xl uppercase leading-none">{plan.name}</span>
                  {annual && plan.annual.save && (
                    <span className="rounded-full bg-electric-indigo px-2.5 py-1 font-code-label text-[11px] font-bold uppercase text-white">
                      {plan.annual.save.replace('Save ', '')} off
                    </span>
                  )}
                </div>
                <p className="mt-2 font-body-md text-body-md text-on-surface-variant">{plan.tagline}</p>

                <div className="mt-5 rounded-xl border border-border-muted bg-surface-container-low px-4 py-3 font-body-md text-body-md font-bold text-on-surface">
                  <span aria-hidden="true" className="material-symbols-outlined mr-2 align-[-4px] text-[18px] text-cyber-lime">bolt</span>
                  {fmtCredits(allowance)} credits/mo
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between font-body-sm text-body-sm">
                    <span className="text-on-surface-variant">Expected monthly usage</span>
                    <span className="font-bold tabular-nums text-cyber-lime">
                      {fmtCredits(needed)}/{fmtCredits(allowance)} credits
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className={`h-full rounded-full ${overflow ? 'bg-error' : 'bg-cyber-lime'}`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                  {autopilot && (
                    <p className="mt-2 font-body-sm text-body-sm text-cyber-lime">autopilot is a Max feature</p>
                  )}
                  {overflow && (
                    <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
                      more than the plan includes - add a credit top-up when you run low.
                    </p>
                  )}
                </div>

                <ul className="mt-5 space-y-2.5">
                  {plan.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface">
                      <span aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[17px] text-cyber-lime">check</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex items-end gap-2">
                  {(annual || plan.monthly.anchor) && (
                    <span className="font-headline-xl text-2xl leading-none text-error line-through decoration-2">
                      ${annual ? plan.monthly.perMo : plan.monthly.anchor}
                    </span>
                  )}
                  <span className="font-headline-xl text-headline-xl leading-none">
                    ${annual ? plan.annual.perMo : plan.monthly.perMo}
                  </span>
                  <span className="mb-0.5 font-body-md text-body-md text-on-surface-variant">/month</span>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    startCheckout(plan.id as 'pro' | 'starter', mode).catch(() => setBusy(false))
                  }}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyber-lime px-6 py-4 font-body-md text-body-md font-bold text-charcoal-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? <><Spinner size={18} /> Starting…</> : `Get ${plan.name}`}
                </button>
                {annual && yearlySavings > 0 && (
                  <p className="mt-3 text-center font-body-sm text-body-sm text-on-surface-variant">
                    <span className="font-bold text-on-surface">Save ${yearlySavings}</span> compared to monthly
                  </p>
                )}
              </div>
            </div>

            {/* billing period toggle, Higgsfield-style bottom-right */}
            <div className="flex items-center justify-end gap-3">
              <span className={`font-body-sm text-body-sm ${!annual ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>Monthly</span>
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
              <span className={`font-body-sm text-body-sm ${annual ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>Annual</span>
              <span className="rounded-full bg-electric-indigo px-2.5 py-1 font-code-label text-[11px] font-bold uppercase text-white">
                Save ${yearlySavings}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
