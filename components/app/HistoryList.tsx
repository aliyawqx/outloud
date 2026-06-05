'use client'

import { useState } from 'react'
import { deleteHistory } from '@/lib/voice/client'
import type { HistoryEntry } from '@/lib/voice/types'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">content_copy</span>
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

export function HistoryList({ initial }: { initial: HistoryEntry[] }) {
  const [entries, setEntries] = useState(initial)
  const [open, setOpen] = useState<string | null>(null)

  async function onDelete(id: string) {
    const prev = entries
    setEntries((e) => e.filter((x) => x.id !== id))
    try {
      await deleteHistory(id)
    } catch {
      setEntries(prev)
    }
  }

  return (
    <ul className="flex flex-col gap-4">
      {entries.map((e) => {
        const expanded = open === e.id
        return (
          <li key={e.id} className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => setOpen(expanded ? null : e.id)}
                aria-expanded={expanded}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-body-md text-body-md text-on-surface">{e.idea}</p>
                <p className="mt-1 font-code-label text-code-label text-on-surface-variant">
                  {e.voiceName || 'voice'} · {e.drafts.length} draft{e.drafts.length === 1 ? '' : 's'} ·{' '}
                  {e.createdAt.slice(0, 10)} {e.createdAt.slice(11, 16)}
                </p>
              </button>
              <button
                onClick={() => onDelete(e.id)}
                aria-label="Delete from history"
                className="text-on-surface-variant transition-colors hover:text-error"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>

            {expanded && (
              <div className="mt-4 flex flex-col gap-3 border-t border-border-muted pt-4">
                {e.drafts.map((d, i) => (
                  <div key={i} className="rounded-xl bg-surface-container-lowest p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-code-label text-code-label uppercase text-on-surface-variant">
                        Draft {i + 1}
                        {d.angle ? ` · ${d.angle}` : ''}
                      </span>
                      <CopyButton text={d.fullText} />
                    </div>
                    <p className="whitespace-pre-wrap font-body-md leading-relaxed text-on-surface">{d.fullText}</p>
                  </div>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
