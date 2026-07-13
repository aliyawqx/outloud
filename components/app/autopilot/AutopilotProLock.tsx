'use client'

import { useState } from 'react'
import { startCheckout } from '@/lib/billing/client'
import { Spinner } from '@/components/Spinner'

// Visible-but-locked (plan-gating spec §7): non-Max users SEE what autopilot
// is - that sells the upgrade better than hiding the page. The CTA goes
// STRAIGHT to Polar checkout (Max, monthly) - never out to the landing pricing.
export function AutopilotProLock() {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-electric-indigo/40 bg-electric-indigo/5 p-6">
      <span className="flex items-center gap-2 rounded-full border border-electric-indigo/60 px-3 py-1 font-code-label text-code-label uppercase text-electric-indigo">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">lock</span>
        Max feature
      </span>
      <p className="font-body-md text-body-md text-on-surface">
        pick a topic, set a time - outloud writes and publishes for you, even when you&apos;re not here. no login needed.
      </p>
      <ul className="flex flex-col gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
        <li>· auto-fills the empty slots on your calendar</li>
        <li>· fully hands-off posting across X, Threads and LinkedIn</li>
        <li>· live links to every published post, right in your notifications</li>
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          startCheckout('pro', 'monthly').catch(() => setBusy(false))
        }}
        className="flex items-center gap-2 rounded-full bg-electric-indigo px-6 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
      >
        {busy ? <><Spinner size={14} /> Starting…</> : 'Upgrade to Max'}
      </button>
    </div>
  )
}
