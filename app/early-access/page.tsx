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

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-margin-mobile">
        <div className="glow-sphere left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />
        <div className="glow-sphere -right-20 -top-20 opacity-30" />

        <section className="reveal bg-surface-glass relative z-10 w-full max-w-[480px] rounded-xl border border-border-muted p-8 backdrop-blur-md md:p-10">
          <div className="mb-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-muted bg-surface-container-high px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyber-lime" />
              <span className="font-code-label text-code-label text-cyber-lime">NOW IN PRIVATE ALPHA</span>
            </div>
            <h1 className="mb-4 font-headline-lg text-headline-lg leading-tight md:text-headline-xl">Get early access to Outloud.</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Join the waitlist of builders and creators. We let pioneers in small cohorts to keep it high-signal.</p>
          </div>

          {sent ? (
            <div className="rounded-lg border border-electric-indigo/30 bg-electric-indigo/10 p-8 text-center">
              <span className="material-symbols-outlined mb-3 text-3xl text-electric-indigo">check_circle</span>
              <h2 className="mb-2 font-headline-lg-mobile text-headline-lg-mobile">You&apos;re on the list, @{handle.replace(/^@+/, '') || 'builder'}.</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">We&apos;ll reach out by email when your spot opens.</p>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="block font-code-label text-code-label uppercase tracking-wider text-on-surface-variant" htmlFor="handle">X Handle</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-body-md text-on-surface-variant">@</div>
                  <input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} required placeholder="username" type="text"
                    className="w-full rounded-lg border border-border-muted bg-surface-container-lowest py-3 pl-10 pr-4 font-body-md transition-all placeholder:text-surface-variant focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block font-code-label text-code-label uppercase tracking-wider text-on-surface-variant" htmlFor="email">Work Email</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-body-md">alternate_email</span>
                  </div>
                  <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" type="email"
                    className="w-full rounded-lg border border-border-muted bg-surface-container-lowest py-3 pl-12 pr-4 font-body-md transition-all placeholder:text-surface-variant focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo" />
                </div>
              </div>
              {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
              <button type="submit" disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-electric-indigo py-4 font-headline-lg-mobile text-headline-lg-mobile text-white transition-all hover:shadow-[0_0_20px_rgba(176,107,255,0.3)] active:scale-[0.98] disabled:opacity-60">
                <span>{loading ? 'Reserving…' : 'Reserve my spot'}</span>
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
            </form>
          )}
        </section>
      </main>
      <ScrollReveal />
    </div>
  )
}
