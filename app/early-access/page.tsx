'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { ScrollReveal } from '@/components/ScrollReveal'

export default function EarlyAccessPage() {
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Try again.')
        return
      }
      setSent(true)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overflow-x-hidden bg-charcoal-black text-on-surface">
      <header className="fixed top-0 z-50 flex h-20 w-full items-center justify-between px-margin-mobile md:px-margin-desktop">
        <Link href="/"><Logo /></Link>
        <Link className="font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-white" href="/">Back to home</Link>
      </header>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-margin-mobile py-28">
        <div className="glow-sphere -left-24 top-1/4 opacity-50" />
        <div className="glow-sphere -right-24 -top-10 opacity-30" />

        <div className="relative z-10 grid w-full max-w-5xl items-center gap-12 md:grid-cols-2">
          {/* Left: pitch + perks */}
          <div className="reveal">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyber-lime" />
              <span className="font-code-label text-code-label uppercase tracking-widest text-cyber-lime">3 of 10 founder spots left</span>
            </div>
            <h1 className="mb-4 font-headline-xl text-headline-xl leading-tight">
              Get early access to{' '}
              <span className="bg-gradient-to-r from-electric-indigo to-secondary bg-clip-text text-transparent">Outloud.</span>
            </h1>
            <p className="mb-6 max-w-md font-body-md text-body-md text-on-surface-variant">
              Builders and creators, let in in small cohorts to keep it high-signal. The first 10 founders lock in a price that never comes back.
            </p>

            <div className="mb-8 inline-flex items-center gap-3 rounded-2xl border border-cyber-lime/30 bg-cyber-lime/10 px-5 py-3">
              <span className="font-code-label text-code-label text-on-surface-variant line-through">$15/mo</span>
              <span className="font-headline-lg text-headline-lg text-cyber-lime">$1/mo</span>
              <span className="font-code-label text-code-label text-on-surface-variant">first 10 founders, for life</span>
            </div>

            <ul className="space-y-3">
              {[
                'Posts in your voice across X, LinkedIn & Telegram',
                'Voice captured from your own posts, never AI slop',
                'Reply engine + trending-post discovery',
                'Shape the product before launch',
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 font-body-sm text-body-sm text-on-surface">
                  <span className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: form card */}
          <section className="reveal glass-card rounded-3xl p-8 md:p-10" style={{ transitionDelay: '120ms' }}>
            <div className="mb-6">
              <h2 className="mb-1 font-headline-lg text-headline-lg">Reserve your spot</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">~30 seconds. i reply within 24h.</p>
            </div>

            {sent ? (
              <div className="rounded-2xl border border-cyber-lime/30 bg-cyber-lime/10 p-8 text-center">
                <span className="material-symbols-outlined mb-3 text-3xl text-cyber-lime">check_circle</span>
                <h3 className="mb-2 font-headline-lg-mobile text-headline-lg-mobile">You&apos;re on the list, @{handle.replace(/^@+/, '') || 'builder'}.</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">I&apos;ll reach out by email when your spot opens.</p>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="block font-code-label text-code-label uppercase tracking-wider text-on-surface-variant" htmlFor="handle">X Handle</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-body-md text-on-surface-variant">@</div>
                    <input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} required placeholder="username" type="text"
                      className="w-full rounded-xl border border-border-muted bg-surface-container-lowest py-3 pl-10 pr-4 font-body-md transition-all placeholder:text-surface-variant focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block font-code-label text-code-label uppercase tracking-wider text-on-surface-variant" htmlFor="email">Work Email</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-body-md">alternate_email</span>
                    </div>
                    <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" type="email"
                      className="w-full rounded-xl border border-border-muted bg-surface-container-lowest py-3 pl-12 pr-4 font-body-md transition-all placeholder:text-surface-variant focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo" />
                  </div>
                </div>
                {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
                <button type="submit" disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-full bg-electric-indigo py-4 font-headline-lg-mobile text-headline-lg-mobile text-white transition-all hover:shadow-[0_0_20px_rgba(176,107,255,0.3)] active:scale-[0.98] disabled:opacity-60">
                  <span>{loading ? 'Reserving…' : 'Reserve my spot'}</span>
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>
                <p className="text-center font-code-label text-code-label text-on-surface-variant">founders only · $1k–10k MRR welcome</p>
              </form>
            )}
          </section>
        </div>
      </main>
      <ScrollReveal />
    </div>
  )
}
