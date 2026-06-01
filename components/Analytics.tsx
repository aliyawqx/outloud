'use client'

import { useReveal } from './hooks'
import { Stat } from './ui'

const DATA = [22, 30, 18, 44, 38, 61, 52, 80, 73, 96]

export function Analytics() {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className="grid"
      data-stack="true"
      style={{ gridTemplateColumns: '1fr 1.05fr', gap: 40, alignItems: 'center' }}
    >
      <div className="reveal win" style={{ padding: 0, order: 1 }}>
        <div className="win__bar">
          <span className="win__lights">
            <i />
            <i />
            <i />
          </span>
          <span className="win__title">outloud / analytics</span>
        </div>
        <div style={{ padding: 22 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
            <Stat label="28d impressions" value="184k" />
            <Stat label="profile clicks" value="2,910" />
            <Stat label="followers" value="+612" accent />
          </div>
          <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 7, padding: '0 2px' }}>
            {DATA.map((d, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: d + '%',
                  background: i === DATA.length - 1 ? 'var(--accent)' : 'var(--surface-3)',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height .4s',
                  transitionDelay: i * 40 + 'ms',
                }}
              />
            ))}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 12, textAlign: 'right' }}>
            posts that sound like you ↗ compound
          </div>
        </div>
      </div>
      <div className="reveal" style={{ order: 2 }}>
        <div className="kicker" style={{ marginBottom: 20 }}>
          03 — close the loop
        </div>
        <h2 className="h-sec" style={{ marginBottom: 18 }}>
          See what landed.
          <br />
          Post more of <span className="accent">that</span>.
        </h2>
        <p className="lede" style={{ marginBottom: 24 }}>
          Impressions, likes and new followers per post — wired straight back in. No more guessing why one post hit and
          ten didn&apos;t. The feedback loop is the whole point: it&apos;s what turns 3-likes-then-silence into a habit
          that compounds.
        </p>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <span className="tag mono">per-post impressions</span>
          <span className="tag mono">likes</span>
          <span className="tag mono">new followers</span>
        </div>
      </div>
    </div>
  )
}
