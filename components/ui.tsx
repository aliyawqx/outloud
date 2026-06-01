import type { ReactNode } from 'react'

export function Logo() {
  return (
    <span className="row center gap-12">
      <span style={{ position: 'relative', width: 26, height: 26, display: 'grid', placeItems: 'center' }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--accent)' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, letterSpacing: '-.02em' }}>
        outloud
      </span>
    </span>
  )
}

export function Avatar({ initials }: { initials: string }) {
  return <div className="tweet__av">{initials}</div>
}

export function Tweet({
  text,
  name = 'jack',
  handle = '@jack_builds',
  initials = 'JK',
  typed,
}: {
  text?: string
  name?: string
  handle?: string
  initials?: string
  typed?: string
}) {
  return (
    <div className="tweet">
      <Avatar initials={initials} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row center gap-8" style={{ flexWrap: 'nowrap' }}>
          <span className="tweet__name">{name}</span>
          <span className="tweet__handle">{handle}</span>
          <span className="tweet__handle" style={{ color: 'var(--faint)' }}>
            · now
          </span>
        </div>
        <div className="tweet__body">{typed !== undefined ? typed : text}</div>
      </div>
    </div>
  )
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: ReactNode
  accent?: boolean
}) {
  return (
    <div className="card" style={{ padding: '14px 14px', textAlign: 'left' }}>
      <div
        className="mono"
        style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: '.08em', textTransform: 'uppercase' }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 600,
          marginTop: 6,
          color: accent ? 'var(--accent)' : 'var(--text)',
          letterSpacing: '-.02em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

export function MatchBadge({ n }: { n: number }) {
  return (
    <span className="tag tag--accent mono" style={{ fontSize: 11.5 }}>
      {n}% your voice
    </span>
  )
}

export function GenericTweet() {
  return (
    <div className="card" style={{ padding: 16, borderColor: 'var(--border)' }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--faint)',
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          marginBottom: 10,
        }}
      >
        chatgpt, every time
      </div>
      <div className="tweet">
        <div className="tweet__av" style={{ color: 'var(--faint)' }}>
          AI
        </div>
        <div style={{ flex: 1 }}>
          <div className="row center gap-8">
            <span className="tweet__name" style={{ color: 'var(--muted)' }}>
              generic founder
            </span>
          </div>
          <div className="tweet__body" style={{ color: 'var(--muted)' }}>
            🚀 Excited to announce DARK MODE is here! Plus 40% faster load times ⚡ We&apos;re committed to delivering
            the best experience for our users. Let us know what you think 👇 #buildinpublic #SaaS
          </div>
        </div>
      </div>
    </div>
  )
}
