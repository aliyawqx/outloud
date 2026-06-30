'use client'

import { useState } from 'react'
import { INTRO_VIDEO_URL } from '@/lib/media'
import { shouldShowIntro } from './tours'

// One-time intro video shown on first /app visit, BEFORE the welcome tour. Skip is
// always available; a "continue" button appears once the clip ends. Either action
// marks welcome_video done (best-effort) and hands off to TourController via the
// outloud:intro-done event so the welcome tour starts with no page reload.
export function WelcomeVideoOverlay({ initialState }: { initialState: Record<string, boolean> }) {
  const [open, setOpen] = useState(() => shouldShowIntro(initialState))
  const [ended, setEnded] = useState(false)
  if (!open) return null

  function dismiss() {
    setOpen(false)
    fetch('/api/onboarding/tour', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tour: 'welcome_video' }),
    }).catch(() => {})
    window.dispatchEvent(new CustomEvent('outloud:intro-done'))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Skip intro"
          className="absolute right-3 top-3 z-10 rounded-full border border-border-muted bg-surface/85 px-3 py-1.5 font-code-label text-code-label text-on-surface-variant backdrop-blur transition-colors hover:text-on-surface"
        >
          skip
        </button>
        <video
          className="aspect-video w-full bg-black"
          src={INTRO_VIDEO_URL}
          controls
          autoPlay
          playsInline
          onEnded={() => setEnded(true)}
        />
        {ended && (
          <div className="flex justify-end border-t border-border-muted px-5 py-3">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-opacity hover:opacity-90"
            >
              continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
