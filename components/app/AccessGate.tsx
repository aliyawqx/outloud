'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Unavailable } from './Unavailable'

// The post-login access question: are you an nFactorial incubator participant?
// Yes → full access (with a draft cap). No → the unavailable / waitlist state.
export function AccessGate() {
  const router = useRouter()
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function choose(value: 'yes' | 'no') {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incubator: value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Try again.')
        setBusy(false)
        return
      }
      if (value === 'no') {
        setAnswer('no') // show the unavailable state in place
        setBusy(false)
      } else {
        router.refresh() // layout re-renders with full access
      }
    } catch {
      setError('Network error. Try again.')
      setBusy(false)
    }
  }

  if (answer === 'no') return <Unavailable />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-6">
        <h1 className="font-headline-xl text-headline-xl">One quick question</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Are you an nFactorial incubator participant?
        </p>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => choose('yes')}
            disabled={busy}
            className="rounded-full bg-electric-indigo px-7 py-3 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            Yes, I am
          </button>
          <button
            type="button"
            onClick={() => choose('no')}
            disabled={busy}
            className="rounded-full border border-border-muted px-7 py-3 font-bold text-on-surface transition-all hover:border-electric-indigo active:scale-95 disabled:opacity-60"
          >
            No
          </button>
        </div>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      </div>
    </div>
  )
}
