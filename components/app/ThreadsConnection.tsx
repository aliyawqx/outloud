'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/Spinner'

type Status = { connected: boolean; username?: string; scope?: string }

export function ThreadsConnection({
  flash,
  allowed = true,
}: {
  flash?: 'connected' | 'error'
  /** Threads is invite-only until Meta's app review passes; false disables Connect. */
  allowed?: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/threads/status')
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
  }, [])

  async function disconnect() {
    setBusy(true)
    try {
      await fetch('/api/threads/disconnect', { method: 'POST' })
      setStatus({ connected: false })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-muted bg-surface-container-low p-4">
      <div className="flex items-center justify-between">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">Threads account</span>
        {status?.connected ? (
          <span className="font-body-sm text-body-sm text-cyber-lime">Connected as @{status.username}</span>
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant/60">Not connected</span>
        )}
      </div>

      {flash === 'connected' && <p className="font-body-sm text-body-sm text-cyber-lime">Threads account connected.</p>}
      {flash === 'error' && <p className="font-body-sm text-body-sm text-error">Could not connect Threads. Try again.</p>}

      {status?.connected ? (
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-border-muted px-5 py-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-error disabled:opacity-60"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : !allowed ? (
        <>
          <button
            type="button"
            disabled
            className="cursor-not-allowed self-start rounded-full bg-electric-indigo px-5 py-2 font-bold text-white opacity-40"
          >
            Connect Threads
          </button>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Threads connections aren&apos;t available for everyone just yet. Want access? Email{' '}
            <a href="mailto:contact@tryoutloud.app" className="text-electric-indigo hover:underline">
              contact@tryoutloud.app
            </a>{' '}
            and we&apos;ll open it up for you.
          </p>
        </>
      ) : (
        <a
          href="/api/threads/connect"
          className="self-start rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-all hover:bg-primary-container active:scale-95"
        >
          Connect Threads
        </a>
      )}
    </div>
  )
}
