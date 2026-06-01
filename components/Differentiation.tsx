'use client'

import { useReveal } from './hooks'
import { Logo, GenericTweet } from './ui'

const COMPETE = [
  {
    name: 'Buffer / Typefully',
    role: 'schedulers',
    blurb: 'queue what you already wrote. but you never write it.',
    v: 'they schedule. outloud writes.',
  },
  {
    name: 'ChatGPT',
    role: 'generic LLM',
    blurb: 'no idea who you are. spits out 🚀 announcement slop.',
    v: 'no voice. just vibes.',
  },
  {
    name: 'AI avatars / faceless',
    role: 'slop farms',
    blurb: 'the exact thing the algorithm is learning to bury.',
    v: "X won't lift it. ever.",
  },
]

export function Differentiation() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      id="why"
      className="section"
      ref={ref}
      style={{
        background: 'var(--bg-2)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="wrap">
        <div className="reveal" style={{ marginBottom: 56, maxWidth: '22ch' }}>
          <div className="kicker" style={{ marginBottom: 20 }}>
            why not just use X
          </div>
          <h2 className="h-sec">
            Everyone else writes <span className="accent">slop</span>. That&apos;s the moat.
          </h2>
        </div>
        <div
          className="grid"
          data-stack="true"
          style={{ gridTemplateColumns: '1.1fr .9fr', gap: 40, alignItems: 'center' }}
        >
          <div className="reveal grid" style={{ gap: 12 }}>
            {COMPETE.map((c) => (
              <div
                key={c.name}
                className="card"
                style={{ padding: 18, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' }}
              >
                <span className="mono" style={{ fontSize: 16, color: 'var(--faint)' }}>
                  ✕
                </span>
                <div>
                  <div className="row center gap-8" style={{ flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16.5 }}>{c.name}</span>
                    <span className="tag mono" style={{ fontSize: 11 }}>
                      {c.role}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 5 }}>{c.blurb}</div>
                </div>
                <span className="mono" style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'right', maxWidth: 120 }}>
                  {c.v}
                </span>
              </div>
            ))}
            <div
              className="card"
              style={{
                padding: 18,
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 16,
                alignItems: 'center',
                borderColor: 'var(--accent)',
                boxShadow: '0 0 0 1px var(--accent), 0 20px 60px -30px var(--accent-line)',
              }}
            >
              <span className="mono accent" style={{ fontSize: 16 }}>
                ✓
              </span>
              <div>
                <div className="row center gap-8" style={{ flexWrap: 'wrap' }}>
                  <Logo />
                </div>
                <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 7 }}>
                  the only one that actually sounds like the founder.
                </div>
              </div>
              <span className="mono accent" style={{ fontSize: 12, textAlign: 'right', maxWidth: 120 }}>
                your voice = the ditch they can&apos;t cross
              </span>
            </div>
          </div>
          <div className="reveal">
            <GenericTweet />
          </div>
        </div>
      </div>
    </section>
  )
}
