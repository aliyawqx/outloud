'use client'

import { useState } from 'react'

// Profile control to replay the one-time intro video. Clears welcome_video on the
// server, then hard-navigates to /app where WelcomeVideoOverlay plays it again.
export function WatchIntroButton() {
  const [busy, setBusy] = useState(false)

  async function watch() {
    setBusy(true)
    try {
      await fetch('/api/onboarding/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: ['welcome_video'] }),
      })
    } catch {
      // best-effort; still navigate so the user isn't stuck
    }
    window.location.assign('/app')
  }

  return (
    <button
      type="button"
      onClick={watch}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-muted px-4 py-2 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo disabled:opacity-60"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">play_circle</span>
      {busy ? 'opening…' : 'watch intro'}
    </button>
  )
}
