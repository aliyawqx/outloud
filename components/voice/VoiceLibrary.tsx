'use client'

import { useMemo, useState } from 'react'
import { allTags, searchSources } from '@/lib/voice/catalog'
import { VoiceSourceCard } from './VoiceSourceCard'

export function VoiceLibrary({
  selectedIds,
  onToggle,
}: {
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const tags = useMemo(() => allTags(), [])
  const results = useMemo(() => searchSources({ query, tags: activeTags }), [query, activeTags])

  const toggleTag = (t: string) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  return (
    <div className="flex flex-col gap-6">
      {/* search */}
      <div className="relative">
        <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
          search
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search creators, styles, tags…"
          aria-label="Search voice creators"
          className="w-full rounded-full border border-border-muted bg-surface-container-lowest py-3 pl-12 pr-4 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none"
        />
      </div>

      {/* tag filter */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by style tag">
        {tags.map((t) => {
          const on = activeTags.includes(t)
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => toggleTag(t)}
              className={`rounded-full border px-3 py-1 font-code-label text-code-label transition-colors ${
                on
                  ? 'border-cyber-lime bg-cyber-lime/10 text-cyber-lime'
                  : 'border-border-muted text-on-surface-variant hover:border-on-surface/40'
              }`}
            >
              {t}
            </button>
          )
        })}
        {activeTags.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTags([])}
            className="rounded-full px-3 py-1 font-code-label text-code-label text-on-surface-variant underline-offset-2 hover:underline"
          >
            clear
          </button>
        )}
      </div>

      {/* grid */}
      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((s) => (
            <VoiceSourceCard
              key={s.id}
              source={s}
              selected={selectedIds.includes(s.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-muted py-16 text-center font-body-sm text-body-sm text-on-surface-variant/60">
          No creators match that. Try a different search or tag.
        </div>
      )}
    </div>
  )
}
