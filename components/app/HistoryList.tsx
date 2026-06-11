'use client'

import Link from 'next/link'
import { useState } from 'react'
import { deleteHistory } from '@/lib/voice/client'
import { replyIntentUrl } from '@/lib/x/replyIntent'
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
                <p className="flex items-center gap-2">
                  {e.replyTo && (
                    <span className="shrink-0 rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-2 py-0.5 font-code-label text-[11px] uppercase text-cyber-lime">
                      Reply
                    </span>
                  )}
                  <span className="truncate font-body-md text-body-md text-on-surface">{e.idea}</span>
                </p>
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
                {e.replyTo && (
                  <a
                    href={e.replyTo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-border-muted bg-surface-container-lowest p-4 transition-colors hover:border-electric-indigo/40"
                  >
                    <span className="font-code-label text-code-label text-on-surface-variant">
                      ↳ replying to {e.replyTo.authorHandle ? `@${e.replyTo.authorHandle}` : 'a post'}
                    </span>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface-variant">{e.replyTo.text}</p>
                  </a>
                )}
                {e.drafts.map((d, i) => (
                  <div key={i} className="rounded-xl bg-surface-container-lowest p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-code-label text-code-label uppercase text-on-surface-variant">
                        {e.replyTo ? 'Reply' : 'Draft'} {i + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        {e.replyTo && (
                          <a
                            href={replyIntentUrl(e.replyTo.tweetId, d.fullText)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">reply</span>
                            Reply on X
                          </a>
                        )}
                        <CopyButton text={d.fullText} />
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap font-body-md leading-relaxed text-on-surface">{d.fullText}</p>
                  </div>
                ))}
                {!e.replyTo && (
                  <Link
                    href={`/app?session=${e.id}`}
                    className="inline-flex w-fit items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container active:scale-95"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">edit</span>
                    Continue editing
                  </Link>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
