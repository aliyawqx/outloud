'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/Logo'

export type SidebarProfile = {
  displayName: string
  avatarUrl: string | null
  plan: string
}

type NavItem = { href: string; label: string; icon: string; badge?: number; soon?: boolean }

function navItems(voiceCount: number): NavItem[] {
  return [
    { href: '/app', label: 'New post', icon: 'edit_square' },
    { href: '/app/voices', label: 'Voices', icon: 'graphic_eq', badge: voiceCount },
    { href: '/app/prompts', label: 'Prompts', icon: 'bookmarks', soon: true },
    { href: '/app/knowledge', label: 'Knowledge', icon: 'menu_book', soon: true },
    { href: '/app/history', label: 'History', icon: 'history' },
  ]
}

export function AppSidebar({ profile, voiceCount }: { profile: SidebarProfile; voiceCount: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const items = navItems(voiceCount)

  const isActive = (href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href))

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
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
    <div className="mt-auto flex flex-col gap-2 border-t border-border-muted p-3">
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
        <span className="min-w-0 flex-1 truncate font-body-sm text-body-sm text-on-surface">{profile.displayName}</span>
      </Link>

      <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2">
        <span className="font-code-label text-code-label text-on-surface-variant">
          Plan · <span className="text-on-surface capitalize">{profile.plan}</span>
        </span>
        <Link href="/pricing" className="font-code-label text-code-label text-cyber-lime hover:brightness-110">
          Upgrade
        </Link>
      </div>

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
            {nav}
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
        {nav}
        {footer}
      </aside>
    </>
  )
}
