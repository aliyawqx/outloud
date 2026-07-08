'use client'

import { useMemo } from 'react'
import { blendProfile } from '@/lib/voice/blend'
import { Spinner } from '@/components/Spinner'
import { getSource } from '@/lib/voice/catalog'

export function BlendPreview({
  selectedIds,
  weights,
  onWeight,
  name,
  onName,
  onClear,
  onSave,
  saving,
  error,
}: {
  selectedIds: string[]
  weights: Record<string, number>
  onWeight: (id: string, w: number) => void
  name: string
  onName: (v: string) => void
  onClear: () => void
  onSave: () => void
  saving: boolean
  error: string
}) {
  const sources = useMemo(
    () => selectedIds.map((id) => getSource(id)).filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [selectedIds],
  )
  const blend = useMemo(
    () =>
      sources.length
        ? blendProfile(sources.map((source) => ({ source, weight: weights[source.id] ?? 3 })))
        : null,
    [sources, weights],
  )
  // Live display percentages, matching the blend's normalization.
  const total = sources.reduce((sum, s) => sum + (weights[s.id] ?? 3), 0)
  const pct = (id: string) => (total > 0 ? Math.round(((weights[id] ?? 3) / total) * 100) : 0)
  const multi = sources.length > 1

  return (
    <aside className="glass-panel sticky top-28 flex flex-col gap-4 rounded-2xl p-6" aria-label="Hybrid voice preview">
      <div className="flex items-center justify-between">
        <h3 className="font-code-label text-code-label uppercase tracking-widest text-electric-indigo">
          Hybrid preview
        </h3>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="font-code-label text-code-label text-on-surface-variant hover:text-on-surface"
          >
            reset
          </button>
        )}
      </div>

      {!blend ? (
        <div className="rounded-xl border border-dashed border-border-muted py-12 text-center font-body-sm text-body-sm text-on-surface-variant/60">
          Pick one or more creators to blend a style that’s yours.
        </div>
      ) : (
        <>
          {/* blend mix: chips when single, weighted sliders when multiple */}
          {!multi ? (
            <div className="flex flex-wrap items-center gap-2">
              {sources.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.avatarUrl} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full" />
                  <span className="font-code-label text-[11px] text-on-surface">{s.displayName}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.avatarUrl} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 rounded-full ring-1 ring-border-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate font-code-label text-[11px] text-on-surface">{s.displayName}</span>
                      <span className="shrink-0 font-code-label text-[11px] tabular-nums text-cyber-lime">{pct(s.id)}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={weights[s.id] ?? 3}
                      onChange={(e) => onWeight(s.id, Number(e.target.value))}
                      aria-label={`Weight for ${s.displayName}`}
                      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-container-high accent-electric-indigo"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* merged tags */}
          <div className="flex flex-wrap gap-1.5">
            {blend.mergedTags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-cyber-lime/30 bg-cyber-lime/10 px-2.5 py-0.5 font-code-label text-[11px] text-cyber-lime"
              >
                {t}
              </span>
            ))}
          </div>

          {/* style summary */}
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-container-lowest p-4 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
            {blend.styleSummary}
          </div>

          {/* name + save */}
          <label className="flex flex-col gap-1">
            <span className="font-code-label text-code-label uppercase text-on-surface-variant">Name this voice</span>
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              maxLength={80}
              placeholder={sources.map((s) => s.displayName.split(' ')[0]).join(' × ')}
              className="w-full rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-2 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none"
            />
          </label>

          {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-full bg-electric-indigo py-3 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {saving ? <><Spinner size={18} /> Saving…</> : 'Save & set active'}
          </button>

          {/* guardrail */}
          <p className="font-code-label text-[11px] leading-relaxed text-on-surface-variant/70">
            Style inspiration only. Outloud writes <span className="text-on-surface-variant">your</span> posts about{' '}
            <span className="text-on-surface-variant">your</span> ideas in this blended style - it never posts as these
            creators or invents quotes from them.
          </p>
        </>
      )}
    </aside>
  )
}
