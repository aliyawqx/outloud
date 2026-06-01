'use client'

import { useState } from 'react'
import { useReveal } from './hooks'

const SPOTS_TOTAL = 10
const SPOTS_LEFT = 6
const PERKS = [
  'Lock in the launch price ($50–100/mo)',
  'Shape the product before it ships',
  'First access when concierge spots open',
  'Your voice, captured — no AI slop',
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 8,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '13px 15px',
  color: 'var(--text)',
  fontSize: 15,
  outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--faint)',
  textTransform: 'uppercase',
  letterSpacing: '.1em',
}

export function Claim() {
  const ref = useReveal<HTMLElement>()
  const [sent, setSent] = useState(false)
  const [handle, setHandle] = useState('')
  const [shipping, setShipping] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, shipping }),
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
    <section
      id="claim"
      className="section"
      ref={ref}
      style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}
    >
      <div className="wrap">
        <div
          className="grid"
          data-stack="true"
          style={{ gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}
        >
          <div className="reveal">
            <div className="kicker" style={{ marginBottom: 22 }}>
              early access · before launch
            </div>
            <h2 className="h-sec" style={{ marginBottom: 20, maxWidth: '14ch' }}>
              Get early access.
            </h2>
            <p className="lede" style={{ marginBottom: 28 }}>
              Join the founders who want to post consistently and grow an audience — in their own voice, without it
              eating their week.
            </p>
            <div className="grid" style={{ gap: 13 }}>
              {PERKS.map((p) => (
                <div key={p} className="row center gap-12">
                  <span className="mono accent" style={{ fontSize: 14, width: 16 }}>
                    ✓
                  </span>
                  <span style={{ fontSize: 15.5, color: 'var(--text)' }}>{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="reveal card" style={{ padding: 28, background: 'var(--surface)' }}>
            <div className="row center between" style={{ marginBottom: 18 }}>
              <span className="tag tag--accent">
                <span className="dot dot--live" /> {SPOTS_LEFT} of {SPOTS_TOTAL} left
              </span>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--faint)' }}>
                $50–100 / mo at launch
              </span>
            </div>

            <div
              style={{
                border: '1px solid var(--accent-line)',
                background: 'var(--accent-soft)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                marginBottom: 22,
              }}
            >
              <div className="row center between" style={{ flexWrap: 'wrap', gap: 8 }}>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase' }}
                >
                  first 10 founders
                </span>
                <span className="row center gap-8">
                  <span
                    className="mono"
                    style={{ fontSize: 13, color: 'var(--faint)', textDecoration: 'line-through' }}
                  >
                    $50–100
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: 24,
                      color: 'var(--accent)',
                      letterSpacing: '-.02em',
                    }}
                  >
                    $20
                  </span>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
                    /mo
                  </span>
                </span>
              </div>
            </div>

            {!sent ? (
              <form onSubmit={onSubmit}>
                <label className="mono" style={labelStyle}>
                  your X handle
                </label>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@you"
                  required
                  style={{ ...inputStyle, marginBottom: 16 }}
                />
                <label className="mono" style={labelStyle}>
                  what are you shipping?
                </label>
                <textarea
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  placeholder="one line on your product + MRR"
                  rows={2}
                  style={{ ...inputStyle, marginBottom: 18, resize: 'none', lineHeight: 1.5 }}
                />
                {error && (
                  <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>
                )}
                <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
                  {loading ? 'sending…' : 'get early access'} <span aria-hidden>→</span>
                </button>
                <div
                  className="mono"
                  style={{ fontSize: 12, color: 'var(--faint)', marginTop: 14, textAlign: 'center' }}
                >
                  founders only · $1k–10k MRR · i reply within 24h
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent-line)',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 18px',
                    color: 'var(--accent)',
                    fontSize: 22,
                  }}
                >
                  ✓
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, marginBottom: 10 }}>
                  you&apos;re on the list, {handle.replace(/^@+/, '') || 'founder'}.
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: '34ch', margin: '0 auto' }}>
                  I&apos;ll DM you on X within 24h with the 5 posts I need to learn your voice — and your $20/mo founder
                  price locked in.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
