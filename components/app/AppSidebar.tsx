'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/Logo'
import { SidebarHistory, type SidebarHistoryItem } from '@/components/app/SidebarHistory'
import { useCredits } from '@/components/app/CreditsContext'
import { fmtCredits } from '@/lib/creditsConfig'

export type SidebarProfile = {
  displayName: string
  avatarUrl: string | null
  plan: string
}

type NavItem = { href: string; label: string; icon: string; badge?: number; soon?: boolean }

// Secondary navigation. The two creation actions (New post / New reply) are
// promoted out of this list into prominent buttons at the top of the sidebar.
function navItems(voiceCount: number): NavItem[] {
  return [
    { href: '/app/voices', label: 'Voices', icon: 'graphic_eq', badge: voiceCount },
    { href: '/app/prompts', label: 'Prompts', icon: 'bookmarks' },
    { href: '/app/knowledge', label: 'Knowledge', icon: 'menu_book', soon: true },
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
  const router = useRouter()
  // A history chat is open when /app carries a ?session — in that case the compose
  // chat (highlighted gray in the History list) is the active item, NOT "New post".
  const viewingChat = Boolean(useSearchParams().get('session'))
  const [open, setOpen] = useState(false)
  const items = navItems(voiceCount)
  const { balance, unlimited } = useCredits()

  const isActive = (href: string) =>
    href === '/app' ? pathname === '/app' && !viewingChat : pathname.startsWith(href)

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  // The two core creation actions, promoted to prominent buttons. "New post" is the
  // hero action (always filled); "New reply" is secondary (tinted when active).
  const create = (
    <div className="flex flex-col gap-2 px-3 pb-3">
      <Link
        href="/app"
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
    <nav className="flex flex-col gap-1 px-3" aria-label="Primary">
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
            ) : it.soon ? (
              <span className="rounded-full border border-border-muted px-2 py-0.5 font-code-label text-[10px] uppercase text-on-surface-variant/60">
                soon
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )

  const footer = (
    <div className="flex flex-col gap-2 border-t border-border-muted p-3">
      <Link
        href="/app/profile"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.04]"
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
          <span className="truncate font-code-label text-code-label text-on-surface-variant">
            {unlimited ? 'Unlimited' : `${fmtCredits(balance)} credits`} · <span className="capitalize">{profile.plan}</span>
          </span>
        </span>
      </Link>

      <Link
        href="/app/settings/billing"
        onClick={() => setOpen(false)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:bg-white/[0.04] hover:text-on-surface"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">receipt_long</span>
        Billing &amp; usage
      </Link>

      <Link
        href="/pricing"
        className="flex items-center justify-center rounded-xl bg-surface-container-low px-3 py-2 font-code-label text-code-label text-cyber-lime transition-colors hover:brightness-110"
      >
        Upgrade plan
      </Link>

      <button
        type="button"
        onClick={signOut}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left font-code-label text-code-label text-on-surface-variant transition-colors hover:bg-white/[0.04] hover:text-error"
      >
        <span className="material-symbols-outlined text-[18px]">logout</span> Sign out
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-muted bg-surface-glass px-margin-mobile py-3 backdrop-blur-md lg:hidden">
        <Link href="/app">
          <Logo />
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-charcoal-black/70" />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface border-r border-border-muted py-4">
            <div className="px-5 pb-4">
              <Logo />
            </div>
            {create}
            {nav}
            <SidebarHistory initial={history} onNavigate={() => setOpen(false)} />
            {footer}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border-muted bg-surface py-5 lg:flex">
        <div className="px-5 pb-5">
          <Link href="/app">
            <Logo />
          </Link>
        </div>
        {create}
        {nav}
        <SidebarHistory initial={history} />
        {footer}
      </aside>
    </>
  )
}
