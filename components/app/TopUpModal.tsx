'use client'

import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { CREDIT_PACKS, fmtCredits, COST_PER_POST, COST_PER_REPLY } from '@/lib/creditsConfig'
import { startPackCheckout } from '@/lib/billing/client'

// The default-selected pack is the "best value" one (the $45 / 500k main top-up).
const DEFAULT_PACK = CREDIT_PACKS.find((p) => p.bestValue) ?? CREDIT_PACKS[0]

// Full-screen top-up card, shown when a user on an active PAID plan runs out of credits.
// (Trial users see UpgradeModal instead - they need a plan, not a top-up.) Pack switcher
// defaults to the $50 main pack. Stresses: plan credits reset at renewal, and top-up
// credits never expire.
export function TopUpModal({ onClose }: { onClose: () => void }) {
  const [packId, setPackId] = useState<string>(DEFAULT_PACK.id)
  const [busy, setBusy] = useState(false)
  const pack = CREDIT_PACKS.find((p) => p.id === packId) ?? DEFAULT_PACK

  async function buy() {
    setBusy(true)
    try {
      await startPackCheckout(pack.id)
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
        <h2 className="font-headline-xl text-headline-xl">Top up to keep going</h2>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Your plan credits reset when your billing month renews - you can wait for that, or top up
          now. <span className="text-on-surface">Top-up credits never expire.</span>
        </p>

        {/* pack switcher - defaults to the $50 main pack */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-border-muted bg-surface-container-low p-1">
          {CREDIT_PACKS.map((p) => (
            <button key={p.id} type="button" className={pill(p.id === packId)} onClick={() => setPackId(p.id)}>
              ${p.priceUsd}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-electric-indigo bg-surface-container-low p-7 text-left indigo-glow">
          <div className="mb-1 flex items-end gap-2">
            <span className="font-headline-xl text-headline-xl leading-none">${pack.priceUsd}</span>
            <span className="mb-1 font-body-md text-body-md text-on-surface-variant/50 line-through">${pack.anchorUsd}</span>
            <span className="mb-1 font-body-md text-body-md text-on-surface-variant">one-time</span>
          </div>
          <p className="mb-5 font-code-label text-code-label text-on-surface-variant">
            {fmtCredits(pack.credits)} credits · never expires
          </p>
          <ul className="mb-6 space-y-2.5">
            <li className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface">
              <span className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
              {fmtCredits(pack.credits)} credits added instantly
            </li>
            <li className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface">
              <span className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
              ≈ {Math.floor(pack.credits / COST_PER_POST)} posts or {Math.floor(pack.credits / COST_PER_REPLY)} replies
            </li>
            <li className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface">
              <span className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
              Never expires - stacks on top of your plan
            </li>
          </ul>
          <button
            type="button"
            onClick={buy}
            disabled={busy}
            className="indigo-glow flex w-full items-center justify-center gap-2 rounded-full bg-electric-indigo px-6 py-3.5 text-lg font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {busy ? <><Spinner size={20} /> Starting…</> : `Buy ${fmtCredits(pack.credits)} · $${pack.priceUsd}`}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
        >
          I’ll wait for the reset
        </button>
      </div>
    </div>
  )
}
