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

const OAUTH_ERRORS: Record<string, string> = {
  google: 'Couldn’t sign in with Google. Please try again.',
  google_unavailable: 'Google sign-in isn’t available right now.',
}

// Official Google "G" mark.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const oauthError = OAUTH_ERRORS[params.get('error') ?? '']
  const googleHref = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`
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
    <div className="flex flex-col gap-4">
      {oauthError && <p className="font-body-sm text-body-sm text-error">{oauthError}</p>}

      {/* Continue with Google — full-page redirect into the OAuth flow. */}
      <a
        href={googleHref}
        className="flex items-center justify-center gap-2.5 rounded-full bg-white py-3 font-bold text-[#1f1f1f] transition-all hover:bg-white/90 active:scale-95"
      >
        <GoogleMark />
        Continue with Google
      </a>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border-muted" />
        <span className="font-code-label text-code-label text-on-surface-variant/60">or</span>
        <span className="h-px flex-1 bg-border-muted" />
      </div>

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
    </form>
    </div>
  )
}
