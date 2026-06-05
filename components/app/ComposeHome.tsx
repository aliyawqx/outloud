'use client'

import Link from 'next/link'
import { useState } from 'react'
import { compose } from '@/lib/voice/client'
import type { DraftPost, HookIntensity } from '@/lib/voice/types'

type VoiceOption = { id: string; name: string; isActive: boolean }
const INTENSITIES: HookIntensity[] = ['safe', 'bold', 'spicy', 'funny']

function DraftCard({ draft, index }: { draft: DraftPost; index: number }) {
  const [text, setText] = useState(draft.fullText)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-code-label text-code-label uppercase tracking-wide text-on-surface-variant">
          Draft {index + 1}
          {draft.angle ? ` · ${draft.angle}` : ''}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing((e) => !e)} aria-pressed={editing} className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{editing ? 'check' : 'edit'}</span>
            {editing ? 'Done' : 'Edit'}
          </button>
          <button onClick={copy} className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">content_copy</span>
            <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-56 w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md leading-relaxed text-on-surface focus:border-electric-indigo focus:outline-none"
        />
      ) : (
        <p className="whitespace-pre-wrap font-body-md leading-relaxed text-on-surface">{text}</p>
      )}
    </div>
  )
}

export function ComposeHome({ name, voices }: { name: string; voices: VoiceOption[] }) {
  const active = voices.find((v) => v.isActive) ?? voices[0]
  const [idea, setIdea] = useState('')
  const [count, setCount] = useState(3)
  const [voiceId, setVoiceId] = useState(active?.id ?? '')
  const [intensity, setIntensity] = useState<HookIntensity>('bold')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<DraftPost[]>([])

  const hasVoice = voices.length > 0

  async function onGenerate() {
    setError('')
    setDrafts([])
    if (!idea.trim()) {
      setError('Drop a line about what you shipped first.')
      return
    }
    setLoading(true)
    try {
      const { drafts } = await compose({ idea, profileId: voiceId || undefined, count, hookIntensity: intensity })
      setDrafts(drafts)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate posts. Try again.")
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
          <p className="font-body-sm text-body-sm text-on-surface">First, capture your voice — paste a few posts and generate your Style Guide.</p>
          <Link href="/app/voices" className="shrink-0 rounded-full bg-cyber-lime px-5 py-2 text-center font-bold text-charcoal-black transition-all hover:brightness-110">
            Set your voice
          </Link>
        </div>
      )}

      {/* composer */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          aria-label="What you shipped"
          placeholder="drop a line about what you shipped…"
          className="h-32 w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
            Voice
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              aria-label="Voice"
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
            Hook
            <select
              value={intensity}
              onChange={(e) => setIntensity(e.target.value as HookIntensity)}
              aria-label="Hook intensity"
              className="rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none"
            >
              {INTENSITIES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
            Drafts
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              aria-label="Number of drafts"
              className="rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="ml-auto rounded-full bg-electric-indigo px-6 py-2.5 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {loading ? 'Writing…' : 'Start writing'}
          </button>
        </div>

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      </div>

      {/* drafts */}
      {loading && (
        <div className="mt-6 rounded-2xl border border-dashed border-border-muted py-12 text-center font-code-label text-code-label text-on-surface-variant/60">
          writing {count} draft{count > 1 ? 's' : ''} in your voice…
        </div>
      )}
      {drafts.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {drafts.map((d, i) => (
            <DraftCard key={i} draft={d} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
