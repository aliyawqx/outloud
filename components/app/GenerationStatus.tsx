'use client'

import type { StatusStep } from '@/lib/compose/stream'

// One line in the live "under the hood" feed. Driven entirely by real backend
// status events (see lib/compose/stream.ts) — ComposeHome paces them so each stays
// visible ≥250ms, then renders them here.
export type FeedStep = {
  id: string
  step: StatusStep | 'error'
  label: string
  tag?: string
  state: 'active' | 'done' | 'error'
}

const TAG_CLASS: Record<string, string> = {
  voice: 'border-electric-indigo/40 text-electric-indigo',
  context: 'border-cyber-lime/40 text-cyber-lime',
  draft: 'border-border-muted text-on-surface-variant',
  polish: 'border-border-muted text-on-surface-variant',
}

function Tag({ tag, dim }: { tag: string; dim?: boolean }) {
  return (
    <span
      className={`rounded-full border px-1.5 py-px font-code-label text-[9px] uppercase tracking-wide ${
        dim ? 'border-border-muted text-on-surface-variant/40' : TAG_CLASS[tag] ?? 'border-border-muted text-on-surface-variant'
      }`}
    >
      {tag}
    </span>
  )
}

export function GenerationStatus({ steps }: { steps: FeedStep[] }) {
  if (steps.length === 0) return null
  // Active (or error) line sits on top; completed steps stack below, newest first.
  const active = steps.find((s) => s.state === 'active' || s.state === 'error')
  const done = steps.filter((s) => s.state === 'done').reverse()

  return (
    <div className="flex flex-col gap-2 self-start rounded-2xl rounded-bl-md bg-surface-container-low px-4 py-3">
      {active && (
        <div className="step-in flex items-center gap-2 font-code-label text-code-label">
          {active.state === 'error' ? (
            <span aria-hidden className="material-symbols-outlined text-[16px] leading-none text-error">error</span>
          ) : (
            <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-electric-indigo" />
          )}
          <span className={active.state === 'error' ? 'text-error' : 'shimmer-text'}>{active.label}</span>
          {active.tag && active.state !== 'error' && <Tag tag={active.tag} />}
        </div>
      )}
      {done.map((s) => (
        <div key={s.id} className="step-in flex items-center gap-2 font-code-label text-code-label text-on-surface-variant/50">
          <span aria-hidden className="material-symbols-outlined text-[14px] leading-none text-cyber-lime/60">check</span>
          <span>{s.label}</span>
          {s.tag && <Tag tag={s.tag} dim />}
        </div>
      ))}
    </div>
  )
}
