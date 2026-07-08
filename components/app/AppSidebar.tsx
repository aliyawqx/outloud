'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/Logo'
import { SidebarHistory, type SidebarHistoryItem } from '@/components/app/SidebarHistory'
import { NotificationsBell } from '@/components/app/NotificationsBell'
import { useCredits } from '@/components/app/CreditsContext'
import { Tooltip } from '@/components/ui/tooltip'
import { fmtCredits } from '@/lib/creditsConfig'

export type SidebarProfile = {
  displayName: string
  avatarUrl: string | null
  plan: string
}

type NavItem = { href: string; label: string; icon: string; badge?: number }

const SIDEBAR_W_KEY = 'outloud_sidebar_w'
const SIDEBAR_HIDDEN_KEY = 'outloud_sidebar_hidden'
const SIDEBAR_DEFAULT_W = 256
const SIDEBAR_MIN_W = 208
const SIDEBAR_MAX_W = 400

// Secondary navigation. The two creation actions (New post / New reply) are
// promoted out of this list into prominent buttons at the top of the sidebar.
function navItems(voiceCount: number): NavItem[] {
  return [
    { href: '/app/autopilot', label: 'Autopilot', icon: 'auto_awesome' },
    { href: '/app/calendar', label: 'Calendar', icon: 'calendar_month' },
    { href: '/app/voices', label: 'Voices', icon: 'graphic_eq', badge: voiceCount },
  ]
}

export function AppSidebar({
  profile,
  voiceCount,
  history,
}: {
  profile: SidebarProfile
  voiceCount: number
  history: SidebarHistoryItem[]
}) {
  const pathname = usePathname()
  // A history chat is open when /app carries a ?session - in that case the compose
  // chat (highlighted gray in the History list) is the active item, NOT "New post".
  const viewingChat = Boolean(useSearchParams().get('session'))
  const [open, setOpen] = useState(false)
  const items = navItems(voiceCount)
  const { balance, unlimited } = useCredits()

  // Desktop sidebar chrome: hideable + drag-resizable, both remembered locally.
  // Read after mount (not in the initializer) so SSR and first client render match.
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_W)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const w = Number(localStorage.getItem(SIDEBAR_W_KEY))
    if (w >= SIDEBAR_MIN_W && w <= SIDEBAR_MAX_W) setWidth(w)
    setHidden(localStorage.getItem(SIDEBAR_HIDDEN_KEY) === '1')
  }, [])

  const toggleHidden = () =>
    setHidden((h) => {
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, h ? '0' : '1')
      return !h
    })

  // The sidebar sits at the left viewport edge, so the pointer's clientX IS the
  // desired width - no rect math needed.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const clamp = (x: number) => Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, x))
    const onMove = (ev: PointerEvent) => setWidth(clamp(ev.clientX))
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      localStorage.setItem(SIDEBAR_W_KEY, String(clamp(ev.clientX)))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const isActive = (href: string) =>
    href === '/app' ? pathname === '/app' && !viewingChat : pathname.startsWith(href)

  // The two core creation actions, promoted to prominent buttons. "New post" is the
  // hero action (always filled); "New reply" is secondary (tinted when active).
  const create = (
    <div className="flex shrink-0 flex-col gap-2 px-3 pb-3">
      <Link
        href="/app"
        data-tour="new-post"
        onClick={() => setOpen(false)}
        aria-current={isActive('/app') ? 'page' : undefined}
        className="flex items-center gap-2 rounded-xl bg-electric-indigo px-3 py-2.5 font-body-md text-body-md font-bold text-white transition-colors hover:bg-primary-container"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit_square</span>
        New post
      </Link>
      <Link
        href="/app/reply"
        onClick={() => setOpen(false)}
        aria-current={isActive('/app/reply') ? 'page' : undefined}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 font-body-md text-body-md transition-colors ${
          isActive('/app/reply')
            ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface'
            : 'border-border-muted text-on-surface-variant hover:border-electric-indigo/60 hover:text-on-surface'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">reply</span>
        New reply
      </Link>
    </div>
  )

  const nav = (
    <nav data-tour="nav" className="flex shrink-0 flex-col gap-1 px-3" aria-label="Primary">
      {items.map((it) => {
        const active = isActive(it.href)
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-body-md text-body-md transition-colors ${
              active
                ? 'bg-electric-indigo/15 text-on-surface'
                : 'text-on-surface-variant hover:bg-white/[0.04] hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${active ? 'text-electric-indigo' : ''}`}>
              {it.icon}
            </span>
            <span className="flex-1">{it.label}</span>
            {it.badge ? (
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-code-label text-[11px] text-on-surface-variant">
                {it.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )

  // Deliberately minimal: the profile row (name, credits · plan) plus the
  // notifications bell. Billing, upgrade and sign-out live ON the profile page.
  const footer = (
    // `relative` anchors the notifications panel (absolute in NotificationsBell)
    // to this row, so it opens upward aligned with the sidebar.
    <div className="relative flex shrink-0 items-center gap-1 border-t border-border-muted p-3">
      <Link
        href="/app/profile"
        data-tour="profile-nav"
        onClick={() => setOpen(false)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.04]"
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-border-muted" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-electric-indigo/20 font-code-label text-code-label text-electric-indigo">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-body-sm text-body-sm text-on-surface">{profile.displayName}</span>
          <span className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant">
            <span className="truncate">
              {unlimited ? 'Unlimited' : `${fmtCredits(balance)} credits`} · <span className="capitalize">{profile.plan}</span>
            </span>
            {!unlimited && (
              <Tooltip label="credits are spent per chat session. start a new chat for each post so they go to drafting, not old context.">
                <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[14px] text-on-surface-variant/60">info</span>
              </Tooltip>
            )}
          </span>
        </span>
      </Link>
      <NotificationsBell />
    </div>
  )

  return (
    <>
      {/* Mobile top bar: menu on the LEFT (matches the left-opening drawer), mascot
          centered. Only the mascot here - the wordmark lives inside the open drawer. */}
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border-muted bg-surface-glass px-margin-mobile backdrop-blur-md lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="-ml-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined">menu</span>
        </button>
        <Link href="/app" aria-label="Outloud home" className="absolute left-1/2 -translate-x-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.svg" alt="Outloud" className="h-8 w-8" />
        </Link>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-charcoal-black/70" />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface border-r border-border-muted py-4">
            <div className="shrink-0 px-5 pb-4">
              <Logo />
            </div>
            {create}
            {nav}
            <SidebarHistory initial={history} onNavigate={() => setOpen(false)} />
            {footer}
          </aside>
        </div>
      )}

      {/* Desktop sidebar - hideable and drag-resizable (right edge). */}
      {hidden ? (
        <button
          type="button"
          aria-label="Show sidebar"
          title="Show sidebar"
          onClick={toggleHidden}
          className="fixed left-3 top-3 z-40 hidden h-10 w-10 items-center justify-center rounded-xl border border-border-muted bg-surface-container text-on-surface-variant shadow-lg transition-colors hover:text-on-surface lg:flex"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">left_panel_open</span>
        </button>
      ) : (
        <aside
          style={{ width }}
          className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border-muted bg-surface py-5 lg:flex"
        >
          <div className="flex shrink-0 items-center justify-between px-5 pb-5">
            <Link href="/app">
              <Logo />
            </Link>
            <button
              type="button"
              aria-label="Hide sidebar"
              title="Hide sidebar"
              onClick={toggleHidden}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">left_panel_close</span>
            </button>
          </div>
          {create}
          {nav}
          <SidebarHistory initial={history} />
          {footer}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={startResize}
            className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize transition-colors hover:bg-electric-indigo/40"
          />
        </aside>
      )}
    </>
  )
}
