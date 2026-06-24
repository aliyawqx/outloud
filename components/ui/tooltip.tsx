import type { ReactNode } from 'react'

// Lightweight CSS-only tooltip (no deps, no JS). Shows on hover/focus of the
// wrapped trigger. Safe to nest inside links/buttons since the trigger is a span.
export function Tooltip({
  label,
  children,
  side = 'top',
  className = '',
}: {
  label: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}) {
  return (
    <span className={`group/tt relative inline-flex items-center ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-[60] w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-border-muted bg-surface-container-high px-3 py-2 text-left font-body-sm text-[12px] normal-case leading-snug tracking-normal text-on-surface opacity-0 shadow-lg shadow-charcoal-black/40 transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 ${
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
      >
        {label}
      </span>
    </span>
  )
}
