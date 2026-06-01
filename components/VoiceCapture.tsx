'use client'

import { useState } from 'react'
import { useReveal } from './hooks'

const FINGERPRINT = [
  'lowercase',
  'short lines',
  'no emoji',
  'self-deprecating',
  'numbers > adjectives',
  'ends mid-thought',
  'no hashtags',
  'dry humor',
]
const SAMPLE_POSTS = [
  'lost a customer today because of a bug i shipped at 2am. lesson: stop shipping at 2am',
  'MRR is flat for the 3rd month. not panicking. ok slightly panicking',
  "rewrote the onboarding for the 4th time. this one's the one. (i have said this 4 times)",
]

export function VoiceCapture() {
  const ref = useReveal<HTMLDivElement>()
  const [count, setCount] = useState(3)
  return (
    <div
      ref={ref}
      className="grid"
      data-stack="true"
      style={{ gridTemplateColumns: '1.05fr 1fr', gap: 40, alignItems: 'center' }}
    >
      <div className="reveal">
        <div className="kicker" style={{ marginBottom: 20 }}>
          01 — capture
        </div>
        <h2 className="h-sec" style={{ marginBottom: 18 }}>
          Paste 5 posts.
          <br />
          It learns how <span className="accent">you</span> sound.
        </h2>
        <p className="lede" style={{ marginBottom: 24 }}>
          No prompt engineering, no &ldquo;act as a witty founder.&rdquo; Outloud reads your real posts and pulls out the
          cadence, the word choice, the things you&apos;d never say. That fingerprint is the moat.
        </p>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {FINGERPRINT.map((f) => (
            <span key={f} className="tag mono">
              {f}
            </span>
          ))}
        </div>
      </div>
      <div className="reveal win" style={{ padding: 0 }}>
        <div className="win__bar">
          <span className="win__lights">
            <i />
            <i />
            <i />
          </span>
          <span className="win__title">onboarding / your voice</span>
        </div>
        <div style={{ padding: 18 }}>
          {SAMPLE_POSTS.map((p, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 10, display: 'flex', gap: 12 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--faint)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 14.5, lineHeight: 1.45, color: 'var(--muted)' }}>{p}</span>
            </div>
          ))}
          <div
            style={{
              border: '1px dashed var(--border-2)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <span className="mono" style={{ fontSize: 13, color: 'var(--faint)' }}>
              + paste {Math.max(0, 5 - count)} more to lock your voice
            </span>
          </div>
          <div className="row center gap-12" style={{ marginTop: 14 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{ width: (count / 5) * 100 + '%', height: '100%', background: 'var(--accent)', transition: 'width .4s' }}
              />
            </div>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--accent)' }}>
              {count}/5
            </span>
            <button
              className="btn btn--ghost"
              style={{ padding: '8px 12px', fontSize: 12.5 }}
              onClick={() => setCount(Math.min(5, count + 1))}
            >
              + add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
