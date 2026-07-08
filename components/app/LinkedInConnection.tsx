'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/Spinner'

type Status = {
  connected: boolean
  name?: string
  status?: 'connected' | 'needs_reconnect'
  expiresAt?: string
  hasRefreshToken?: boolean
}

const EXPIRY_NUDGE_MS = 7 * 86_400_000

export function LinkedInConnection({ flash }: { flash?: 'connected' | 'error' }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/linkedin/status')
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
  }, [])

  async function disconnect() {
    setBusy(true)
    try {
      await fetch('/api/linkedin/disconnect', { method: 'POST' })
      setStatus({ connected: false })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const needsReconnect = status?.connected && status.status === 'needs_reconnect'
  // Proactive nudge (spec §5): no refresh token means the 60-day token dies
  // silently - warn a week ahead so there is no posting gap.
  const expiringSoon = Boolean(
    status?.connected &&
      status.status === 'connected' &&
      !status.hasRefreshToken &&
      status.expiresAt &&
      new Date(status.expiresAt).getTime() - Date.now() < EXPIRY_NUDGE_MS,
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-muted bg-surface-container-low p-4">
      <div className="flex items-center justify-between">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">LinkedIn account</span>
        {status?.connected ? (
          needsReconnect ? (
            <span className="font-body-sm text-body-sm text-error">Needs reconnect</span>
          ) : (
            <span className="font-body-sm text-body-sm text-cyber-lime">Connected{status.name ? ` as ${status.name}` : ''}</span>
          )
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant/60">Not connected</span>
        )}
      </div>

      {flash === 'connected' && <p className="font-body-sm text-body-sm text-cyber-lime">LinkedIn account connected.</p>}
      {flash === 'error' && <p className="font-body-sm text-body-sm text-error">Could not connect LinkedIn. Try again.</p>}
      {needsReconnect && (
        <p className="font-body-sm text-body-sm text-error">
          connection expired - reconnect to keep posting to linkedin.
        </p>
      )}
      {expiringSoon && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          expires soon - reconnect to avoid a posting gap.
        </p>
      )}

      {status?.connected && !needsReconnect ? (
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-border-muted px-5 py-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-error disabled:opacity-60"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <a
          href="/api/linkedin/connect"
          className="self-start rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-all hover:bg-primary-container active:scale-95"
        >
          {needsReconnect ? 'Reconnect LinkedIn' : 'Connect LinkedIn'}
        </a>
      )}
    </div>
  )
}
