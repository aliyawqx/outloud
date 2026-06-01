'use client'

import { useReveal } from './hooks'

const CYCLE = [
  { n: '01', t: 'you ship something good', d: 'dark mode, a fix, a milestone. real progress.' },
  { n: '02', t: 'you force out a post', d: 'stiff, over-thought, nothing like how you actually talk.' },
  { n: '03', t: '3 likes', d: 'the algorithm shrugs. so do your would-be customers.' },
  { n: '04', t: 'you go quiet for 6 months', d: 'and the compounding never starts. sound familiar?' },
]

export function Problem() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      className="section section--tight"
      ref={ref}
      style={{
        background: 'var(--bg-2)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="wrap">
        <div className="reveal kicker kicker--muted" style={{ marginBottom: 22 }}>
          the cycle that kills indie founders
        </div>
        <div
          className="grid"
          data-stack="true"
          style={{ gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}
        >
          <h2 className="reveal h-sec" style={{ maxWidth: '14ch' }}>
            The build-in-public death spiral.
          </h2>
          <div className="reveal">
            <p className="lede" style={{ marginBottom: 20 }}>
              Jack built Friends Map to <span style={{ color: 'var(--text)' }}>$6.4k MRR</span>, then watched it bleed
              out — not because the product broke, but because he stopped showing up. The posts felt fake, so he
              didn&apos;t post. No posts, no top-of-funnel, no MRR.
            </p>
            <span className="tag tag--accent mono">the problem was never the product. it was the silence.</span>
          </div>
        </div>
        <div
          className="grid"
          data-stack="true"
          style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 56 }}
        >
          {CYCLE.map((c, i) => (
            <div key={c.n} className="reveal card" style={{ padding: 20, position: 'relative' }}>
              <div className="mono accent" style={{ fontSize: 13, marginBottom: 14 }}>
                {c.n}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 18,
                  letterSpacing: '-.01em',
                  marginBottom: 8,
                }}
              >
                {c.t}
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.45 }}>{c.d}</div>
              {i < CYCLE.length - 1 && (
                <span
                  className="mono"
                  style={{ position: 'absolute', right: -11, top: '50%', color: 'var(--faint)', zIndex: 2 }}
                >
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
