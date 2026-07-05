'use client'

import { useEffect, useState } from 'react'

type Notif = { id: string; kind: string; title: string; body: string | null; readAt: string | null; createdAt: string }

const KIND_ICON: Record<string, string> = {
  autopilot_queued: 'auto_awesome',
  autopilot_paused: 'pause_circle',
  publish_failed: 'error',
}

// Lightweight in-app notifications surface (spec §8): a bell + dropdown panel.
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { notifications: [], unread: 0 }))
      .then((d) => { setItems(d.notifications ?? []); setUnread(d.unread ?? 0) })
      .catch(() => {})
  }, [])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        onClick={toggleOpen}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:bg-white/[0.04] hover:text-on-surface"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">notifications</span>
        Notifications
        {unread > 0 && (
          <span className="ml-auto rounded-full bg-electric-indigo px-2 py-0.5 font-code-label text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 max-h-80 w-72 overflow-y-auto rounded-2xl border border-border-muted bg-surface-container p-2 shadow-2xl">
          {items.length === 0 ? (
            <p className="p-3 font-body-sm text-body-sm text-on-surface-variant/60">nothing yet</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-xl p-2.5 hover:bg-white/[0.04]">
                <span aria-hidden="true" className={`material-symbols-outlined mt-0.5 text-[18px] ${n.kind === 'publish_failed' ? 'text-error' : 'text-electric-indigo'}`}>
                  {KIND_ICON[n.kind] ?? 'info'}
                </span>
                <span className="min-w-0">
                  <span className="block font-body-sm text-body-sm text-on-surface">{n.title}</span>
                  {n.body && <span className="block font-code-label text-code-label text-on-surface-variant">{n.body}</span>}
                  <span className="block font-code-label text-[10px] text-on-surface-variant/50">
                    {new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
