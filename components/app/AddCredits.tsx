'use client'

import { useState } from 'react'
import { CREDIT_PACKS, fmtCredits } from '@/lib/creditsConfig'
import { startPackCheckout } from '@/lib/billing/client'
import { Spinner } from '@/components/Spinner'

// Top-ups are only for users on an active paid plan. When not eligible (free user
// or in trial) the packs are shown disabled with a short reason.
export function AddCredits({ eligible = true, reason }: { eligible?: boolean; reason?: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function buy(pack: string) {
    setError('')
    setBusy(pack)
    try {
      await startPackCheckout(pack) // redirects to Polar on success
    } catch (e) {
      setError((e as Error).message || "Couldn't start checkout.")
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-muted bg-surface-container-low p-4">
      <span className="font-code-label text-code-label uppercase text-on-surface-variant">Add credits</span>
      {!eligible && reason && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">{reason}</p>
      )}
      <div className={`grid gap-2 sm:grid-cols-3 ${!eligible ? 'pointer-events-none opacity-50' : ''}`}>
        {CREDIT_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => buy(p.id)}
            disabled={busy !== null || !eligible}
            className={`relative flex flex-col items-center gap-1 rounded-xl border px-4 py-3 transition-colors hover:border-electric-indigo disabled:opacity-60 ${
              p.bestValue ? 'border-electric-indigo' : 'border-border-muted'
            }`}
          >
            {p.bestValue && (
              <span className="absolute -top-2 right-2 rounded-full bg-electric-indigo px-2 py-0.5 font-code-label text-[10px] uppercase text-white">
                Best value
              </span>
            )}
            <span className="font-body-sm text-body-sm font-bold text-on-surface">
              {fmtCredits(p.credits)}
            </span>
            <span className="font-code-label text-code-label text-on-surface-variant">credits</span>
            <span className="mt-1 inline-flex items-center gap-1.5 font-code-label text-code-label">
              {busy === p.id ? <Spinner size={12} /> : null}
              <span className="text-on-surface-variant/50 line-through">${p.anchorUsd}</span>
              <span className="font-bold text-electric-indigo">${p.priceUsd}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </div>
  )
}
