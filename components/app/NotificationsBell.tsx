'use client'

import { useEffect, useRef, useState } from 'react'

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
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

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
      // Refetch on open - the sidebar persists across client navigations, so the
      // mount-time snapshot goes stale as autopilot creates notifications.
      await loadNotifications()
      setUnread(0)
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
    }
  }

  return (
    // No `relative` here on purpose: the panel anchors to the nearest positioned
    // ancestor - the sidebar footer row - so it aligns with the sidebar edge
    // instead of overflowing off-screen from the icon's corner.
    <div ref={rootRef}>
      {/* Compact icon-only trigger - it sits inline next to the profile row. */}
      <button
        type="button"
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        title="Notifications"
        aria-expanded={open}
        onClick={toggleOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-white/[0.04] hover:text-on-surface"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">notifications</span>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-electric-indigo px-1 font-code-label text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-2 z-50 mb-1 max-h-80 w-72 overflow-y-auto rounded-2xl border border-border-muted bg-surface-container p-2 shadow-2xl">
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
              // A notification with a link is a tap-through anchor. In-app links
              // (e.g. the post page) open here; external ones in a new tab.
              const external = Boolean(n.link && !n.link.startsWith('/'))
              return n.link ? (
                <a
                  key={n.id}
                  href={n.link}
                  {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                  className="group flex items-start gap-2 rounded-xl p-2.5 hover:bg-white/[0.04]"
                >
                  {inner}
                </a>
              ) : (
                <div key={n.id} className="flex items-start gap-2 rounded-xl p-2.5 hover:bg-white/[0.04]">
                  {inner}
                </div>
              )
            })
          )}
          {/* Tap-through to the full history page - the dropdown only shows recents. */}
          <a
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center justify-center gap-1 rounded-xl border-t border-border-muted p-2.5 font-code-label text-code-label text-electric-indigo hover:bg-white/[0.04]"
          >
            View all notifications
            <span aria-hidden="true" className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </a>
        </div>
      )}
    </div>
  )
}
