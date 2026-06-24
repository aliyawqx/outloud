'use client'

import { useState } from 'react'
import { ALL_TOURS } from './tours'

// Profile control to replay the onboarding tours. Clears every tour's completion on
// the server, then hard-navigates to /app so the layout re-reads fresh state and the
// welcome (and subsequent per-page) tours fire again.
export function ReplayTours() {
  const [busy, setBusy] = useState(false)

  async function replay() {
    setBusy(true)
    try {
      await fetch('/api/onboarding/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: ALL_TOURS }),
      })
    } catch {
      // best-effort; still navigate so the user isn't stuck
    }
    window.location.assign('/app')
  }

  return (
    <div data-tour="replay-tours" className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-border-muted bg-surface-container-low p-4">
      <div className="min-w-0">
        <p className="font-body-sm text-body-sm text-on-surface">Product tours</p>
        <p className="font-code-label text-code-label text-on-surface-variant/70">replay the welcome + per-page tours.</p>
      </div>
      <button
        type="button"
        onClick={replay}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-muted px-4 py-2 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo disabled:opacity-60"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">replay</span>
        {busy ? 'replaying…' : 'replay tours'}
      </button>
    </div>
  )
}
