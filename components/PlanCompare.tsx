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
  { label: 'Posts in your voice', cost: COST_PER_POST },
  { label: 'Replies', cost: COST_PER_REPLY },
  { label: 'AI images', cost: COST_PER_AI_PHOTO },
  { label: 'Topic searches', cost: COST_PER_TOPIC_SEARCH },
  { label: 'Stock photo searches', cost: COST_PER_PHOTO_SEARCH },
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
  return (
    <section className="mx-auto max-w-5xl px-margin-mobile py-16 md:px-margin-desktop">
      <div className="reveal mb-8 text-center">
        <h2 className="mb-2 font-headline-lg text-headline-lg">Compare features</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">See in detail what each plan gets you.</p>
      </div>

      <div className="reveal overflow-x-auto rounded-2xl border border-border-muted">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-muted bg-surface-container-lowest">
              <th className="p-4 font-code-label text-code-label uppercase text-on-surface-variant/60">Plan</th>
              {COLS.map((c) => (
                <th key={c.id} className={`p-4 ${c.highlight ? 'bg-electric-indigo/10' : ''}`}>
                  <span className="block font-body-md text-body-md font-bold text-on-surface">{c.name}</span>
                  <span className="block font-code-label text-code-label text-on-surface-variant">{c.priceLine}</span>
                  <span className="block font-code-label text-code-label text-on-surface-variant">
                    {fmtCredits(c.allowance)} credits {c.per === 'total' ? 'to start' : '/ mo'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border-muted bg-surface-container-lowest/50">
              <td colSpan={4} className="px-4 py-2 font-code-label text-code-label uppercase text-on-surface-variant/60">
                What your credits buy
              </td>
            </tr>
            {ACTIONS.map((a) => (
              <tr key={a.label} className="border-b border-border-muted">
                <td className="p-4">
                  <span className="block font-body-sm text-body-sm text-on-surface">{a.label}</span>
                  <span className="block font-code-label text-code-label text-on-surface-variant/60">
                    {fmtCredits(a.cost)} credits each
                  </span>
                </td>
                {COLS.map((c) => (
                  <td key={c.id} className={`p-4 font-body-sm text-body-sm text-on-surface tabular-nums ${c.highlight ? 'bg-electric-indigo/10' : ''}`}>
                    {Math.floor(c.allowance / a.cost).toLocaleString()}
                    <span className="ml-1 font-code-label text-code-label text-on-surface-variant/60">
                      {c.per === 'total' ? 'total' : '/ mo'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-b border-border-muted bg-surface-container-lowest/50">
              <td colSpan={4} className="px-4 py-2 font-code-label text-code-label uppercase text-on-surface-variant/60">
                Features
              </td>
            </tr>
            {FEATURES.map((f) => (
              <tr key={f.label} className="border-b border-border-muted last:border-b-0">
                <td className="p-4 font-body-sm text-body-sm text-on-surface">{f.label}</td>
                {COLS.map((c, i) => (
                  <td key={c.id} className={`p-4 ${c.highlight ? 'bg-electric-indigo/10' : ''}`}>{check(f.on[i])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="reveal mt-4 text-center font-code-label text-code-label text-on-surface-variant/60">
        Credits are one shared pool - mix actions however you like.
      </p>
    </section>
  )
}
