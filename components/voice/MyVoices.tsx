'use client'

import { useState } from 'react'
import { getSource } from '@/lib/voice/catalog'
import type { VoiceProfile } from '@/lib/voice/types'

function BuiltFrom({ profile }: { profile: VoiceProfile }) {
  if (profile.kind === 'own') {
    return <span className="font-code-label text-code-label text-on-surface-variant">your own captured voice</span>
  }
  const sources = profile.sources.map((s) => getSource(s.sourceId)).filter(Boolean)
  return (
    <div className="flex items-center gap-1.5">
      {sources.map(
        (s) =>
          s && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.id}
              src={s.avatarUrl}
              alt={s.displayName}
              title={s.displayName}
              width={20}
              height={20}
              className="h-5 w-5 rounded-full ring-1 ring-border-muted"
            />
          ),
      )}
      <span className="ml-1 font-code-label text-code-label text-on-surface-variant">
        {sources.length} creator{sources.length === 1 ? '' : 's'}
      </span>
    </div>
  )
}

export function MyVoices({
  profiles,
  onSetActive,
  onDelete,
  onRename,
  busyId,
}: {
  profiles: VoiceProfile[]
  onSetActive: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  busyId: string | null
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <ul className="flex flex-col gap-4">
      {profiles.map((p) => {
        const busy = busyId === p.id
        return (
          <li
            key={p.id}
            className={`glass-panel flex flex-col gap-3 rounded-2xl p-5 transition-all ${
              p.isActive ? 'border-cyber-lime shadow-[0_0_28px_-14px] shadow-cyber-lime/40' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {editing === p.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draft.trim()) {
                        onRename(p.id, draft.trim())
                        setEditing(null)
                      }
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    onBlur={() => setEditing(null)}
                    maxLength={80}
                    aria-label="Rename voice"
                    className="rounded-lg border border-electric-indigo bg-surface-container-lowest px-2 py-1 font-body-md text-on-surface focus:outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-body-md text-body-md font-semibold text-on-surface">{p.name}</h3>
                    {p.isActive && (
                      <span className="rounded-full bg-cyber-lime px-2 py-0.5 font-code-label text-[10px] font-bold text-charcoal-black">
                        ACTIVE
                      </span>
                    )}
                    <span className="rounded-full border border-border-muted px-2 py-0.5 font-code-label text-[10px] uppercase text-on-surface-variant">
                      {p.kind}
                    </span>
                  </div>
                )}
                <div className="mt-2">
                  <BuiltFrom profile={p} />
                </div>
              </div>
            </div>

            {/* merged tags */}
            {p.mergedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.mergedTags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-electric-indigo/30 bg-electric-indigo/10 px-2 py-0.5 font-code-label text-[11px] text-primary-fixed-dim"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* actions */}
            <div className="flex flex-wrap items-center gap-4 border-t border-border-muted pt-3">
              <button
                type="button"
                disabled={busy || p.isActive}
                onClick={() => onSetActive(p.id)}
                className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-cyber-lime disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">{p.isActive ? 'check_circle' : 'radio_button_unchecked'}</span>
                {p.isActive ? 'Active' : 'Set active'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(p.id)
                  setDraft(p.name)
                }}
                className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Rename
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(p.id)}
                className="ml-auto flex items-center gap-1 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-error disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
