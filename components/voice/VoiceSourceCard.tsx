'use client'

import type { VoiceSource } from '@/lib/voice/types'

export function VoiceSourceCard({
  source,
  selected,
  onToggle,
}: {
  source: VoiceSource
  selected: boolean
  onToggle: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(source.id)}
      aria-pressed={selected}
      className={`glass-panel group relative flex flex-col gap-3 rounded-2xl p-5 text-left transition-all hover:border-on-surface/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-indigo ${
        selected ? 'border-cyber-lime shadow-[0_0_28px_-12px] shadow-cyber-lime/40' : ''
      }`}
    >
      {/* selected check */}
      <span
        className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full transition-all ${
          selected ? 'bg-cyber-lime text-charcoal-black' : 'border border-border-muted text-transparent'
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">check</span>
      </span>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source.avatarUrl}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          className="h-11 w-11 rounded-full bg-surface-container object-cover ring-1 ring-border-muted"
        />
        <div className="min-w-0">
          <div className="truncate font-body-md text-body-md font-semibold text-on-surface">{source.displayName}</div>
          <div className="truncate font-code-label text-code-label text-on-surface-variant">@{source.handle}</div>
        </div>
      </div>

      <p className="line-clamp-3 font-body-sm text-body-sm text-on-surface-variant">{source.styleDescriptor}</p>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {source.tags.map((t) => (
          <span
            key={t}
            className="rounded-full border border-electric-indigo/30 bg-electric-indigo/10 px-2.5 py-0.5 font-code-label text-[11px] text-primary-fixed-dim"
          >
            {t}
          </span>
        ))}
      </div>
    </button>
  )
}
