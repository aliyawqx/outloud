'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { addSample, createOwnVoice, deleteSample, generateStyleGuide } from '@/lib/voice/client'
import type { SampleSource } from '@/lib/voice/types'

type Sample = { id: string; source: SampleSource; text: string }
type XStatus = { connected: boolean; username?: string }

// "Enough to get started" threshold. Extraction works on less, but this is the
// point where a Style Guide has real signal to learn from.
const WORD_GOAL = 150

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

export function VoiceOnboarding({
  profileId: initialProfileId,
  authorName,
  initialSamples,
}: {
  profileId: string | null
  authorName: string
  initialSamples: Sample[]
}) {
  const router = useRouter()
  const [profileId, setProfileId] = useState(initialProfileId)
  const [samples, setSamples] = useState<Sample[]>(initialSamples)
  const [mode, setMode] = useState<'paste' | 'url'>('paste')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [xStatus, setXStatus] = useState<XStatus | null>(null)
  const [continuing, setContinuing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const totalWords = samples.reduce((n, s) => n + wordCount(s.text), 0)
  const pct = Math.min(100, Math.round((totalWords / WORD_GOAL) * 100))
  const enough = totalWords >= WORD_GOAL

  useEffect(() => {
    fetch('/api/x/status')
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then(setXStatus)
      .catch(() => setXStatus({ connected: false }))
  }, [])

  /** Lazily create the own-voice draft the first time a sample is added. Name it
   *  after the author: their X handle if connected, else their profile name. */
  async function ensureProfile(): Promise<string> {
    if (profileId) return profileId
    const name = xStatus?.username ? `@${xStatus.username}` : authorName || 'My voice'
    const { profile } = await createOwnVoice(name)
    setProfileId(profile.id)
    return profile.id
  }

  async function addText(source: 'paste' | 'upload', text: string) {
    const id = await ensureProfile()
    const { sample } = await addSample(id, { source, text })
    setSamples((s) => [{ id: sample.id, source: sample.source, text: sample.text }, ...s])
  }

  async function onAdd() {
    const val = draft.trim()
    if (!val) return
    setError('')
    setBusy(true)
    try {
      if (mode === 'url') {
        const id = await ensureProfile()
        const { sample } = await addSample(id, { source: 'url', url: val })
        setSamples((s) => [{ id: sample.id, source: sample.source, text: sample.text }, ...s])
      } else {
        await addText('paste', val)
      }
      setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that.')
    } finally {
      setBusy(false)
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const text = (await file.text()).trim()
        if (text) await addText('upload', text)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  async function importFromX() {
    setError('')
    setBusy(true)
    try {
      const id = await ensureProfile()
      const res = await fetch('/api/x/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(res.status === 409 ? data.error ?? 'Connect your X account first.' : data.error ?? 'Could not import.')
        return
      }
      const added: Sample[] = (data.samples ?? []).map((s: Sample) => ({ id: s.id, source: s.source, text: s.text }))
      setSamples((s) => [...added, ...s])
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (!profileId) return
    const prev = samples
    setSamples((s) => s.filter((x) => x.id !== id))
    try {
      await deleteSample(profileId, id)
    } catch {
      setSamples(prev)
    }
  }

  async function onContinue() {
    if (!profileId || !enough) return
    setError('')
    setContinuing(true)
    try {
      await generateStyleGuide(profileId) // the ONE universal extraction prompt
      router.push('/app')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build your voice. Try again.')
      setContinuing(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-headline-xl text-headline-xl">Set up your voice</h1>
      <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
        Add a few things you’ve written and we’ll learn how you write. Everything you generate after
        this will sound like you, not like generic AI.
      </p>

      {/* progress */}
      <div className="mb-6 rounded-2xl border border-border-muted bg-surface-container-low p-4">
        <div className="mb-2 flex items-center justify-between font-code-label text-code-label text-on-surface-variant">
          <span>{enough ? 'Enough to get started' : 'Add a bit more to get started'}</span>
          <span>{totalWords} / {WORD_GOAL} words</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div
            className={`h-full rounded-full transition-all ${enough ? 'bg-cyber-lime' : 'bg-electric-indigo'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error && <p className="mb-4 font-body-sm text-body-sm text-error">{error}</p>}

      {/* sources */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border-muted bg-surface-container-low p-4">
        {/* X (read-only) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-body-sm text-body-sm text-on-surface">Pull your recent X posts</p>
            <p className="font-code-label text-code-label text-on-surface-variant/70">
              Read-only. We never post on your behalf.
            </p>
          </div>
          {xStatus?.connected ? (
            <button
              type="button"
              onClick={importFromX}
              disabled={busy}
              className="rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container disabled:opacity-60"
            >
              Import from @{xStatus.username}
            </button>
          ) : (
            <a
              href="/api/x/connect?returnTo=/app/onboarding"
              className="rounded-full border border-border-muted px-4 py-2 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo"
            >
              Connect X (read-only)
            </a>
          )}
        </div>

        <div className="h-px bg-border-muted" />

        {/* paste / url toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setMode('paste'); setDraft('') }}
            aria-pressed={mode === 'paste'}
            className={`rounded-full px-3 py-1 font-code-label text-code-label transition-colors ${mode === 'paste' ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Paste text
          </button>
          <button
            type="button"
            onClick={() => { setMode('url'); setDraft('') }}
            aria-pressed={mode === 'url'}
            className={`rounded-full px-3 py-1 font-code-label text-code-label transition-colors ${mode === 'url' ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Add URL
          </button>
        </div>

        {mode === 'paste' ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="paste a few of your posts / writing…"
            className="h-28 w-full resize-none rounded-lg border border-border-muted bg-surface-container-lowest p-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none"
          />
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://… (an X post link, blog, or page you wrote)"
            className="w-full rounded-lg border border-border-muted bg-surface-container-lowest p-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none"
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAdd}
            disabled={busy || !draft.trim()}
            className="rounded-full bg-electric-indigo px-5 py-1.5 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>

          {/* upload + drag&drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files) }}
            className={`flex-1 rounded-lg border border-dashed px-3 py-2 text-center font-code-label text-code-label transition-colors ${dragOver ? 'border-electric-indigo text-on-surface' : 'border-border-muted text-on-surface-variant/70'}`}
          >
            <button type="button" onClick={() => fileRef.current?.click()} className="hover:text-on-surface">
              Drop files here or click to upload
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".txt,.md,.markdown,text/*"
              className="hidden"
              onChange={(e) => { onFiles(e.target.files); e.target.value = '' }}
            />
          </div>
        </div>
      </div>

      {/* samples list */}
      {samples.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {samples.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-border-muted bg-surface-container-low p-3">
              <p className="line-clamp-2 flex-1 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface-variant">{s.text}</p>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                aria-label="Delete sample"
                className="shrink-0 text-on-surface-variant/60 transition-colors hover:text-error"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* continue */}
      <button
        type="button"
        onClick={onContinue}
        disabled={!enough || continuing}
        className="w-full rounded-full bg-cyber-lime px-6 py-3 font-bold text-charcoal-black transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {continuing ? 'Building your voice…' : enough ? 'Continue' : 'Add more to continue'}
      </button>

      {/* celebrity path → existing voice library */}
      <p className="mt-5 text-center font-body-sm text-body-sm text-on-surface-variant">
        Want to write in a creator’s voice instead?{' '}
        <Link href="/app/voices" className="text-electric-indigo hover:underline">
          Browse the voice library
        </Link>
      </p>
    </div>
  )
}
