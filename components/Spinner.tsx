// One consistent loading spinner, used in every button/indicator that waits on
// an async action. Uses the Material Symbols "progress_activity" glyph, spun via
// Tailwind's animate-spin (disabled under prefers-reduced-motion).
export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined inline-block animate-spin leading-none motion-reduce:animate-none ${className}`}
      style={{ fontSize: size }}
    >
      progress_activity
    </span>
  )
}
