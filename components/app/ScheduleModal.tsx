'use client'

import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import type { DraftImage } from '@/components/app/DraftImageControls'

// Hand-rolled modal, matching the TopUpModal pattern (no shared Modal primitive).
// The datetime-local input reads in the browser's local time; we convert to UTC
// ISO for storage and send the browser's IANA zone for display + slot math.

function defaultWhen(): string {
  // Next full hour, local, in datetime-local format (YYYY-MM-DDTHH:MM).
  const d = new Date(Date.now() + 60 * 60_000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

export function ScheduleModal({
  text,
  images,
  platforms,
  onClose,
  onScheduled,
}: {
  text: string
  images: DraftImage[]
  platforms: string[]
  onClose: () => void
  onScheduled: (whenIso: string) => void
}) {
  const [when, setWhen] = useState(defaultWhen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  async function schedule() {
    const local = new Date(when)
    if (Number.isNaN(local.getTime())) {
      setError('Pick a date and time.')
      return
    }
    if (local.getTime() <= Date.now()) {
      setError('Pick a time in the future.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          platforms,
          media: images.map((i) => ({ url: i.url, alt: i.alt })),
          scheduledFor: local.toISOString(),
          timezone,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not schedule. Try again.')
        return
      }
      onScheduled(local.toISOString())
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Schedule post" className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-charcoal-black/70 backdrop-blur-[4px]" />
      <div className="relative w-full max-w-md rounded-3xl border border-border-muted bg-surface p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h2 className="mb-1 font-headline-lg text-headline-lg">Schedule this post</h2>
        <p className="mb-5 font-body-sm text-body-sm text-on-surface-variant">
          It goes out automatically at the time you pick ({timezone.replace(/_/g, ' ')}).
        </p>

        <label className="mb-1 block font-code-label text-code-label uppercase text-on-surface-variant/70" htmlFor="schedule-when">
          Publish at
        </label>
        <input
          id="schedule-when"
          type="datetime-local"
          value={when}
          min={defaultWhen().slice(0, 16)}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-xl border border-border-muted bg-surface-container-lowest p-3 font-body-md text-on-surface [color-scheme:dark] focus:border-electric-indigo focus:outline-none"
        />

        <p className="mt-3 font-code-label text-code-label text-on-surface-variant/60">
          Posting to: {platforms.map((p) => (p === 'x' ? 'X' : 'Threads')).join(' + ')}
        </p>

        {error && <p className="mt-3 font-body-sm text-body-sm text-error">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={schedule}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {busy ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">event</span>}
            {busy ? 'Scheduling…' : 'Schedule'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border-muted px-5 py-2.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
