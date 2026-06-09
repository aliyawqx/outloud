'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { SignOutButton } from './SignOutButton'

// Post-signup gate: the user must enter the 6-digit code emailed to them before
// they reach the app. On success the layout re-renders past this gate.
export function VerifyEmail({ email }: { email: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)

  const canSubmit = /^\d{6}$/.test(code) && !busy

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Try again.')
        setBusy(false)
        return
      }
      router.refresh() // layout re-renders, gate is gone
    } catch {
      setError('Network error. Try again.')
      setBusy(false)
    }
  }

  async function resend() {
    setError('')
    setResent(false)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/verify/resend', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not send a new code. Try again.')
      } else {
        setResent(true)
      }
    } catch {
      setError('Network error. Try again.')
    }
    setBusy(false)
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="glass-panel flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border-cyber-lime/30 p-8">
        <h1 className="font-headline-lg text-headline-lg">Check your email</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          We sent a 6-digit code to <span className="text-on-surface">{email}</span>. Enter it to
          finish setting up your account.
        </p>
        <form onSubmit={submit} className="flex w-full flex-col items-center gap-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError('')
            }}
            placeholder="123456"
            aria-label="Verification code"
            className="w-full rounded-2xl border border-border-muted bg-transparent px-5 py-3 text-center font-headline-sm text-headline-sm tracking-[0.4em] text-on-surface outline-none transition-colors focus:border-electric-indigo"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-electric-indigo px-7 py-3 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {busy ? <><Spinner size={18} /> Verifying…</> : 'Verify'}
          </button>
        </form>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        {resent && !error && (
          <p className="font-body-sm text-body-sm text-cyber-lime">A new code is on its way.</p>
        )}
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="font-body-sm text-body-sm text-on-surface-variant underline-offset-2 transition-colors hover:text-on-surface hover:underline disabled:opacity-60"
        >
          Didn’t get it? Resend code
        </button>
      </div>
      <SignOutButton className="fixed bottom-5 left-5" />
    </div>
  )
}
