'use client'

import { useEffect, useState } from 'react'

type Notif = { id: string; kind: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }

const KIND_ICON: Record<string, string> = {
  autopilot_queued: 'auto_awesome',
  autopilot_paused: 'pause_circle',
  publish_failed: 'error',
  reconnect_needed: 'link_off',
  low_credits: 'account_balance_wallet',
  post_published: 'open_in_new',
}

// Lightweight in-app notifications surface (spec §8): a bell + dropdown panel.
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)

  async function loadNotifications() {
    try {
      const r = await fetch('/api/notifications')
      if (!r.ok) return
      const d = await r.json()
      setItems(d.notifications ?? [])
      setUnread(d.unread ?? 0)
    } catch {}
  }

  useEffect(() => { void loadNotifications() }, [])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      // Refetch on open — the sidebar persists across client navigations, so the
      // mount-time snapshot goes stale as autopilot creates notifications.
      await loadNotifications()
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
            items.map((n) => {
              const inner = (
                <>
                  <span aria-hidden="true" className={`material-symbols-outlined mt-0.5 text-[18px] ${n.kind === 'publish_failed' || n.kind === 'reconnect_needed' ? 'text-error' : 'text-electric-indigo'}`}>
                    {KIND_ICON[n.kind] ?? 'info'}
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-body-sm text-body-sm text-on-surface ${n.link ? 'group-hover:underline' : ''}`}>{n.title}</span>
                    {n.body && <span className="block break-words font-code-label text-code-label text-on-surface-variant">{n.body}</span>}
                    <span className="block font-code-label text-[10px] text-on-surface-variant/50">
                      {new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </>
              )
              // A notification with a link (e.g. the live post) is a tap-through anchor.
              return n.link ? (
                <a key={n.id} href={n.link} target="_blank" rel="noreferrer" className="group flex items-start gap-2 rounded-xl p-2.5 hover:bg-white/[0.04]">
                  {inner}
                </a>
              ) : (
                <div key={n.id} className="flex items-start gap-2 rounded-xl p-2.5 hover:bg-white/[0.04]">
                  {inner}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
