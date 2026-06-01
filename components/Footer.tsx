import { Logo } from './ui'

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '44px 0' }}>
      <div className="wrap row center between" style={{ flexWrap: 'wrap', gap: 18 }}>
        <Logo />
        <span className="mono" style={{ fontSize: 13, color: 'var(--faint)', maxWidth: '42ch' }}>
          built in public, out loud. the internet&apos;s about to get loud and fake — be the one real voice.
        </span>
        <span className="mono" style={{ fontSize: 12.5, color: 'var(--faint)' }}>
          © 2026 outloud
        </span>
      </div>
    </footer>
  )
}
