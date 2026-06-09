'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Spinner } from '@/components/Spinner'

type Mode = 'signup' | 'login'

/** Only allow internal redirects (e.g. /app/voices), never an external URL. */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

const field =
  'w-full rounded-lg border border-border-muted bg-surface-container-lowest px-4 py-3 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const isSignup = mode === 'signup'

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignup ? { displayName, email, password } : { email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Try again.')
        return
      }
      router.push(next ?? data.redirect ?? '/app')
      router.refresh()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {isSignup && (
        <label className="flex flex-col gap-1.5">
          <span className="font-code-label text-code-label uppercase text-on-surface-variant">Name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={field}
            placeholder="how should we greet you?"
            autoComplete="name"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
          placeholder={isSignup ? 'at least 8 characters' : 'your password'}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
        />
      </label>

      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex items-center justify-center gap-2 rounded-full bg-electric-indigo py-3 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
      >
        {loading ? <><Spinner size={18} /> One sec…</> : isSignup ? 'Create account' : 'Log in'}
      </button>

      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
        {isSignup ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-electric-indigo hover:text-primary">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/signup" className="text-electric-indigo hover:text-primary">
              Create an account
            </Link>
          </>
        )}
      </p>

      {/* TODO: OAuth (Google / X) and email verification + password reset. */}
    </form>
  )
}
