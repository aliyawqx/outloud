'use client'

import Link from 'next/link'
import { useState } from 'react'

type VoiceOption = { id: string; name: string; isActive: boolean }
type Draft = { hook: string; story: string; offer: string; fullText: string }

export function ComposeHome({ name, voices }: { name: string; voices: VoiceOption[] }) {
  const active = voices.find((v) => v.isActive) ?? voices[0]
  const [idea, setIdea] = useState('')
  const [count, setCount] = useState(1)
  const [voiceId, setVoiceId] = useState(active?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [placeholder, setPlaceholder] = useState(false)

  const hasVoice = voices.length > 0

  async function onGenerate() {
    setError('')
    setDraft(null)
    if (!idea.trim()) {
      setError('Drop a line about what you shipped first.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/voice/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, profileId: voiceId || undefined, count }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Couldn't start writing. Try again.")
        return
      }
      setDraft(data.draft)
      setPlaceholder(Boolean(data.placeholder))
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-headline-xl text-headline-xl">
        what are we shipping today, <span className="text-electric-indigo">{name}</span>?
      </h1>
      <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
        Drop a rough line about what you shipped and Outloud turns it into a post in your voice.
      </p>

      {!hasVoice && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-cyber-lime/30 bg-cyber-lime/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body-sm text-body-sm text-on-surface">
            First, pick the creators you want to write like — that becomes your voice.
          </p>
          <Link
            href="/app/voices"
            className="shrink-0 rounded-full bg-cyber-lime px-5 py-2 text-center font-bold text-charcoal-black transition-all hover:brightness-110"
          >
            Set your voice
          </Link>
        </div>
      )}

      {/* composer */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="drop a line about what you shipped…"
          className="h-32 w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
            Voice
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              disabled={!hasVoice}
              className="rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none disabled:opacity-50"
            >
              {hasVoice ? (
                voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.isActive ? ' (active)' : ''}
                  </option>
                ))
              ) : (
                <option>no voice yet</option>
              )}
            </select>
          </label>

          <label className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
            Drafts
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="ml-auto rounded-full bg-electric-indigo px-6 py-2.5 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {loading ? 'Starting…' : 'Start writing'}
          </button>
        </div>

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      </div>

      {/* draft */}
      {draft && (
        <div className="mt-6 rounded-2xl border border-border-muted bg-surface-container-low p-6">
          {placeholder && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyber-lime/30 bg-cyber-lime/10 px-3 py-1 font-code-label text-[11px] uppercase tracking-wide text-cyber-lime">
              <span className="material-symbols-outlined text-[14px]">science</span>
              Sample preview — live generation coming soon
            </div>
          )}
          <p className="whitespace-pre-wrap font-body-md leading-relaxed text-on-surface">{draft.fullText}</p>
        </div>
      )}
    </div>
  )
}
