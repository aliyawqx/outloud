'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { addSample, createOwnVoice, deleteSample, generateStyleGuide } from '@/lib/voice/client'
import type { SampleSource } from '@/lib/voice/types'

type Sample = { id: string; source: SampleSource; text: string }
type XStatus = { connected: boolean; username?: string }

// "Enough to get started" threshold. Extraction works on less, but this is the
// point where a Style Guide has real signal to learn from.
const WORD_GOAL = 150

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

// Human label for a sample's origin, shown as a small badge in the list.
const SOURCE_LABEL: Record<SampleSource, string> = {
  paste: 'pasted',
  upload: 'file',
  url: 'link',
  x: 'X',
}

// Official X (Twitter) glyph — used to make the fastest path instantly recognizable.
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// Two-dot step indicator so users always know where they are in the flow.
function Stepper({ step }: { step: 1 | 2 }) {
  const dot = (n: 1 | 2, label: string) => {
    const active = step === n
    const done = step > n
    return (
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border font-code-label text-[11px] transition-colors ${
            active
              ? 'border-cyber-lime bg-cyber-lime/10 text-cyber-lime'
              : done
                ? 'border-cyber-lime/40 bg-cyber-lime/10 text-cyber-lime'
                : 'border-border-muted text-on-surface-variant/60'
          }`}
        >
          {done ? <span className="material-symbols-outlined text-[14px]">check</span> : n}
        </span>
        <span
          className={`font-code-label text-code-label transition-colors ${
            active ? 'text-on-surface' : 'text-on-surface-variant/60'
          }`}
        >
          {label}
        </span>
      </div>
    )
  }
  return (
    <div className="mb-6 flex items-center gap-3">
      {dot(1, 'Name')}
      <span className="h-px w-6 bg-border-muted" />
      {dot(2, 'Teach')}
    </div>
  )
}

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
  // Step 1 = name the voice (pre-filled with the account name, editable, required).
  // Step 2 = give it a source. A returning in-progress draft skips straight to step 2.
  const [step, setStep] = useState<1 | 2>(initialProfileId ? 2 : 1)
  const [voiceName, setVoiceName] = useState(authorName)
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

  /** Create the own-voice draft with the user-chosen name. Called when finishing step 1
   *  (so the name persists even if they drop off later), or lazily if a sample is added
   *  before a profile exists. */
  async function ensureProfile(): Promise<string> {
    if (profileId) return profileId
    const name = voiceName.trim() || authorName || 'My voice'
    const { profile } = await createOwnVoice(name)
    setProfileId(profile.id)
    return profile.id
  }

  // Step 1 → step 2: lock in the name by creating the draft now (persists it).
  async function onNameContinue() {
    if (!voiceName.trim() || busy) return
    setError('')
    setBusy(true)
    try {
      await ensureProfile()
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the name. Try again.')
    } finally {
      setBusy(false)
    }
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

  // ── Step 1: name the voice (pre-filled, editable, required) ──
  if (step === 1) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-margin-mobile py-12">
        <Stepper step={1} />
        <h1 className="mb-2 font-headline-xl text-headline-xl">Name your voice</h1>
        <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
          This is how it shows up in your library. We pre-filled your name — keep it or change it.
        </p>

        <label htmlFor="voice-name" className="mb-2 block font-code-label text-code-label text-on-surface-variant">
          Voice name
        </label>
        <input
          id="voice-name"
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onNameContinue() }}
          placeholder="e.g. Aliya"
          autoFocus
          className="w-full rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none focus:ring-2 focus:ring-electric-indigo/30"
        />
        {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="button"
          onClick={onNameContinue}
          disabled={!voiceName.trim() || busy}
          className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-electric-indigo px-6 py-3 font-bold text-white transition-colors duration-200 hover:bg-primary-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <><Spinner size={18} /> Saving…</> : <>Continue<span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span></>}
        </button>

        <p className="mt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
          Want to write in a creator’s voice instead?{' '}
          <Link href="/app/voices" className="text-electric-indigo hover:underline">Browse the voice library</Link>
        </p>
      </div>
    )
  }

  // ── Step 2: give the voice a source (connect X / paste / URL / upload) ──
  const displayName = voiceName.trim() || authorName
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-margin-mobile py-12">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Stepper step={2} />
        <button
          type="button"
          onClick={() => { setError(''); setStep(1) }}
          className="inline-flex cursor-pointer items-center gap-1 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back
        </button>
      </div>

      <h1 className="mb-2 font-headline-xl text-headline-xl">Teach “{displayName}” how you write</h1>
      <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
        Add a few things you’ve written and we’ll learn your style. Everything you generate after this
        will sound like you — not like generic AI.
      </p>

      {/* progress */}
      <div className="mb-6 rounded-2xl border border-border-muted bg-surface-container-low p-4">
        <div className="mb-2 flex items-center justify-between font-code-label text-code-label">
          <span className={enough ? 'text-cyber-lime' : 'text-on-surface-variant'}>
            {enough ? '✓ Enough to get started' : 'Add a bit more to get started'}
          </span>
          <span className="text-on-surface-variant tabular-nums">{totalWords} / {WORD_GOAL} words</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${enough ? 'bg-cyber-lime' : 'bg-electric-indigo'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error && <p className="mb-4 font-body-sm text-body-sm text-error">{error}</p>}

      {/* Fastest path: import straight from X */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-electric-indigo/40 bg-electric-indigo/5 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-on-surface/5 text-on-surface">
            <XLogo className="h-5 w-5" />
          </span>
          <div>
            <p className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
              Import your recent X posts
              <span className="rounded-full bg-cyber-lime/15 px-2 py-0.5 font-code-label text-[10px] text-cyber-lime">FASTEST</span>
            </p>
            <p className="font-code-label text-code-label text-on-surface-variant/70">
              Read-only. We never post on your behalf.
            </p>
          </div>
        </div>
        {xStatus?.connected ? (
          <button
            type="button"
            onClick={importFromX}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-colors duration-200 hover:bg-primary-container disabled:opacity-60"
          >
            {busy && <Spinner size={14} />}
            Import from @{xStatus.username}
          </button>
        ) : (
          <a
            href="/api/x/connect?returnTo=/app/onboarding"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border-muted px-4 py-2 font-code-label text-code-label text-on-surface transition-colors duration-200 hover:border-electric-indigo"
          >
            <XLogo className="h-3.5 w-3.5" />
            Connect X
          </a>
        )}
      </div>

      {/* Divider */}
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border-muted" />
        <span className="font-code-label text-code-label text-on-surface-variant/50">or add writing yourself</span>
        <span className="h-px flex-1 bg-border-muted" />
      </div>

      {/* Manual sources */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border-muted bg-surface-container-low p-4">
        {/* paste / url toggle */}
        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-border-muted bg-surface-container-lowest p-1">
          <button
            type="button"
            onClick={() => { setMode('paste'); setDraft('') }}
            aria-pressed={mode === 'paste'}
            className={`cursor-pointer rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors duration-200 ${mode === 'paste' ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Paste text
          </button>
          <button
            type="button"
            onClick={() => { setMode('url'); setDraft('') }}
            aria-pressed={mode === 'url'}
            className={`cursor-pointer rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors duration-200 ${mode === 'url' ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Add URL
          </button>
        </div>

        {mode === 'paste' ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a few of your posts, a blog excerpt, anything you’ve written in your own words…"
            className="h-28 w-full resize-none rounded-lg border border-border-muted bg-surface-container-lowest p-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none focus:ring-2 focus:ring-electric-indigo/30"
          />
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://… (an X post link, blog, or page you wrote)"
            className="w-full rounded-lg border border-border-muted bg-surface-container-lowest p-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none focus:ring-2 focus:ring-electric-indigo/30"
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAdd}
            disabled={busy || !draft.trim()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-colors duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <><Spinner size={16} /> Adding…</> : 'Add'}
          </button>

          {/* upload + drag&drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files) }}
            className={`flex-1 rounded-lg border border-dashed px-3 py-2.5 text-center font-code-label text-code-label transition-colors duration-200 ${dragOver ? 'border-electric-indigo bg-electric-indigo/5 text-on-surface' : 'border-border-muted text-on-surface-variant/70'}`}
          >
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex cursor-pointer items-center gap-1.5 hover:text-on-surface">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">upload_file</span>
              Drop files or click to upload
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

      {/* samples list / empty state */}
      {samples.length > 0 ? (
        <div className="mb-6 flex flex-col gap-2">
          <p className="font-code-label text-code-label text-on-surface-variant/70">
            {samples.length} sample{samples.length === 1 ? '' : 's'} added
          </p>
          {samples.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-border-muted bg-surface-container-low p-3">
              <div className="min-w-0 flex-1">
                <span className="mb-1 inline-block rounded-full bg-surface-container-high px-2 py-0.5 font-code-label text-[10px] uppercase tracking-wide text-on-surface-variant/70">
                  {SOURCE_LABEL[s.source]}
                </span>
                <p className="line-clamp-2 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface-variant">{s.text}</p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                aria-label="Delete sample"
                className="shrink-0 cursor-pointer text-on-surface-variant/60 transition-colors hover:text-error"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border-muted bg-surface-container-lowest px-4 py-8 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[28px] text-on-surface-variant/40">draw</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Nothing added yet</p>
          <p className="font-code-label text-code-label text-on-surface-variant/60">
            Import from X or paste a few posts above — about 150 words is enough to start.
          </p>
        </div>
      )}

      {/* continue */}
      <button
        type="button"
        onClick={onContinue}
        disabled={!enough || continuing}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-cyber-lime px-6 py-3 font-bold text-charcoal-black transition-all duration-200 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {continuing ? <><Spinner size={18} /> Building your voice…</> : enough ? 'Build my voice' : 'Add more to continue'}
      </button>

      {/* celebrity path → existing voice library */}
      <p className="mt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
        Want to write in a creator’s voice instead?{' '}
        <Link href="/app/voices" className="text-electric-indigo hover:underline">
          Browse the voice library
        </Link>
      </p>
    </div>
  )
}
