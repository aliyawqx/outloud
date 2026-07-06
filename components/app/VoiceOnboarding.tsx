'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { addSample, createOwnVoice, deleteSample, generateStyleGuide } from '@/lib/voice/client'
import type { SampleSource } from '@/lib/voice/types'

type Sample = { id: string; source: SampleSource; text: string }
type XStatus = { connected: boolean; username?: string }

// Enough signal to build a real Style Guide. Used to gate the build button — never shown
// as a raw "x / 150" number (reads as machine-made); we show a friendly state instead.
const WORD_GOAL = 150
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

const SOURCE_LABEL: Record<SampleSource, string> = { paste: 'pasted', upload: 'file', url: 'link', x: 'X' }

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

type Step = 1 | 2 | 3 | 4
const STEP_LABELS = ['Name', 'Source', 'Build', 'Autopilot'] as const

function Stepper({ step }: { step: Step }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step
        const active = step === n
        const done = step > n
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-5 bg-border-muted" />}
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border font-code-label text-[11px] ${
                active || done ? 'border-cyber-lime bg-cyber-lime/10 text-cyber-lime' : 'border-border-muted text-on-surface-variant/60'
              }`}
            >
              {done ? <span className="material-symbols-outlined text-[14px]">check</span> : n}
            </span>
            <span className={`font-code-label text-code-label ${active ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>{label}</span>
          </div>
        )
      })}
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
  const searchParams = useSearchParams()
  const [profileId, setProfileId] = useState(initialProfileId)
  const [samples, setSamples] = useState<Sample[]>(initialSamples)
  // 1 = name · 2 = pick a method · 3 = add writing + build. A returning draft skips
  // naming; if it already has samples, jump to the build step.
  const [step, setStep] = useState<Step>(initialProfileId ? (initialSamples.length > 0 ? 3 : 2) : 1)
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
  const enough = totalWords >= WORD_GOAL
  const pct = Math.min(100, Math.round((totalWords / WORD_GOAL) * 100))
  const displayName = voiceName.trim() || authorName
  // Did we just come back from the X connect round-trip? Then auto-import.
  const justConnectedX = searchParams.get('x') === 'connected'
  const xError = searchParams.get('x') === 'error'
  const autoImported = useRef(false)

  useEffect(() => {
    fetch('/api/x/status')
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then(setXStatus)
      .catch(() => setXStatus({ connected: false }))
  }, [])

  async function ensureProfile(): Promise<string> {
    if (profileId) return profileId
    const { profile } = await createOwnVoice(voiceName.trim() || authorName || 'My voice')
    setProfileId(profile.id)
    return profile.id
  }

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

  // Import the connected account's recent posts, then move to the build step. Shared by
  // the "Import" button and the auto-import after the connect round-trip.
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
        setError(data.error ?? 'Could not import your posts. Paste your writing instead.')
        setStep(3)
        return
      }
      const added: Sample[] = (data.samples ?? []).map((s: Sample) => ({ id: s.id, source: s.source, text: s.text }))
      setSamples((s) => [...added, ...s])
      if (added.length === 0) setError('No posts found on your X — paste a few things you’ve written instead.')
      setStep(3)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  // Pick "Connect X": not connected → start the read-only connect flow (we come back to
  // ?x=connected and auto-import below); connected → import now.
  async function chooseX() {
    if (busy) return
    if (!xStatus?.connected) {
      await ensureProfile().catch(() => {})
      window.location.href = '/api/x/connect?returnTo=/app/onboarding'
      return
    }
    await importFromX()
  }

  // Back from the X connect round-trip → import automatically once status confirms, so
  // the user isn't left staring at the screen after authorizing.
  useEffect(() => {
    if (!justConnectedX || autoImported.current) return
    if (!xStatus?.connected) return // wait until /api/x/status confirms the connection
    autoImported.current = true
    importFromX()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConnectedX, xStatus])

  // Surface a failed connect (with the reason) instead of silently doing nothing.
  useEffect(() => {
    if (!xError) return
    const reason = searchParams.get('xr')
    const msg =
      reason === 'denied'
        ? 'X sign-in was cancelled. Try again, or paste your writing instead.'
        : reason === 'state'
          ? 'That connection timed out. Tap Connect X again, or paste your writing instead.'
          : reason === 'auth'
            ? 'Couldn’t connect X right now. Paste your writing instead — it works just as well.'
            : 'Couldn’t connect X. Try again, or paste your writing instead.'
    setError(msg)
  }, [xError, searchParams])

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

  async function onBuild() {
    if (!profileId || !enough) return
    setError('')
    setContinuing(true)
    try {
      await generateStyleGuide(profileId)
      setContinuing(false)
      setStep(4) // voice is ready — offer autopilot before entering the app
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build your voice. Try again.')
      setContinuing(false)
    }
  }

  // Step 4 — zero-touch autopilot (skippable). The whole ask is a topic and a
  // time (addendum A.1); publishing runs server-side with no review gate by
  // default — the review toggle lives in Autopilot settings for those who want it.
  const [apInterests, setApInterests] = useState('')
  const [apTime, setApTime] = useState('09:00')
  const [apTimezone, setApTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

  async function finishOnboarding(skip: boolean) {
    setError('')
    setBusy(true)
    try {
      const interests = apInterests.split(',').map((s) => s.trim()).filter(Boolean)
      if (!skip && interests.length > 0) {
        const res = await fetch('/api/autopilot', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interests,
            postingTimes: [{ time: apTime }],
            timezone: apTimezone,
            platforms: ['x', 'threads', 'linkedin'],
            enabled: true,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? 'Could not save autopilot settings.')
          setBusy(false)
          return
        }
      }
      router.push('/app')
      router.refresh()
    } catch {
      setError('Network error. Try again.')
      setBusy(false)
    }
  }

  const shell = 'mx-auto flex min-h-screen flex-col justify-center px-margin-mobile py-12'
  const creatorLink = (
    <p className="mt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
      Or write in a creator’s voice —{' '}
      <Link href="/app/voices" className="text-electric-indigo hover:underline">browse the library</Link>
    </p>
  )

  // ── Step 1: name ──
  if (step === 1) {
    return (
      <div className={`${shell} max-w-md`}>
        <Stepper step={1} />
        <h1 className="mb-2 font-headline-xl text-headline-xl">Name your voice</h1>
        <p className="mb-6 font-body-md text-body-md text-on-surface-variant">Keep your name or pick anything.</p>
        <input
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onNameContinue() }}
          aria-label="Voice name"
          placeholder="e.g. Aliya"
          autoFocus
          className="w-full rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none focus:ring-2 focus:ring-electric-indigo/30"
        />
        {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
        <button
          type="button"
          onClick={onNameContinue}
          disabled={!voiceName.trim() || busy}
          className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-electric-indigo px-6 py-3 font-bold text-white transition-colors hover:bg-primary-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <><Spinner size={18} /> Saving…</> : <>Continue<span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span></>}
        </button>
        {creatorLink}
      </div>
    )
  }

  // ── Step 2: pick ONE method (clear either/or) ──
  if (step === 2) {
    return (
      <div className={`${shell} max-w-2xl`}>
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

        <h1 className="mb-2 font-headline-xl text-headline-xl">How should we learn your style?</h1>
        <p className="mb-6 font-body-md text-body-md text-on-surface-variant">Pick one — you only need one.</p>

        {error && <p className="mb-4 font-body-sm text-body-sm text-error">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Option A — Connect X (fastest) */}
          <button
            type="button"
            onClick={chooseX}
            disabled={busy}
            className="group relative flex cursor-pointer flex-col items-start gap-3 rounded-2xl border border-electric-indigo/40 bg-electric-indigo/5 p-5 text-left transition-colors hover:border-electric-indigo disabled:opacity-60"
          >
            <span className="absolute right-4 top-4 rounded-full bg-cyber-lime/15 px-2 py-0.5 font-code-label text-[10px] text-cyber-lime">FASTEST</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-on-surface/5 text-on-surface">
              <XLogo className="h-5 w-5" />
            </span>
            <span className="font-headline-sm text-lg font-bold text-on-surface">
              {busy ? 'Working…' : xStatus?.connected ? `Import from @${xStatus.username}` : 'Connect X'}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              We read your recent posts to learn how you write. Read-only — we never post for you.
            </span>
            {busy && <Spinner size={16} className="text-electric-indigo" />}
          </button>

          {/* Option B — Paste your writing */}
          <button
            type="button"
            onClick={() => { setError(''); setMode('paste'); setStep(3) }}
            className="group flex cursor-pointer flex-col items-start gap-3 rounded-2xl border border-border-muted bg-surface-container-low p-5 text-left transition-colors hover:border-electric-indigo/60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-on-surface/5 text-on-surface">
              <span aria-hidden="true" className="material-symbols-outlined">content_paste</span>
            </span>
            <span className="font-headline-sm text-lg font-bold text-on-surface">Paste your writing</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Drop in a few posts or paragraphs you’ve already written. No account needed.
            </span>
          </button>
        </div>
        {creatorLink}
      </div>
    )
  }

  // ── Step 4: autopilot (skippable) ──
  if (step === 4) {
    const inputCls =
      'w-full rounded-xl border border-border-muted bg-surface-container-lowest p-3 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none'
    return (
      <div className={`${shell} max-w-md`}>
        <Stepper step={4} />
        <h1 className="mb-2 font-headline-xl text-headline-xl">Put your posting on autopilot</h1>
        <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
          give it a topic and a time — outloud writes and publishes in your voice on its own. it runs on our servers: no login needed, ever.
        </p>

        <label className="mb-1 block font-code-label text-code-label uppercase text-on-surface-variant/70" htmlFor="ap-interests">
          Topic(s), comma-separated
        </label>
        <input id="ap-interests" value={apInterests} onChange={(e) => setApInterests(e.target.value)} placeholder="e.g. building in public, ai tools" className={inputCls} />

        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block font-code-label text-code-label uppercase text-on-surface-variant/70" htmlFor="ap-time">Posting time</label>
            <input id="ap-time" type="time" value={apTime} onChange={(e) => setApTime(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block font-code-label text-code-label uppercase text-on-surface-variant/70" htmlFor="ap-tz">Timezone</label>
            <select id="ap-tz" value={apTimezone} onChange={(e) => setApTimezone(e.target.value)} className={inputCls}>
              {Intl.supportedValuesOf('timeZone').map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mt-3 font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="button"
          onClick={() => finishOnboarding(false)}
          disabled={busy || apInterests.split(',').every((s) => !s.trim())}
          className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-electric-indigo px-6 py-3 font-bold text-white transition-colors hover:bg-primary-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <><Spinner size={18} /> Starting…</> : <>Start autopilot<span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span></>}
        </button>
        <button type="button" onClick={() => finishOnboarding(true)} disabled={busy} className="mt-3 w-full text-center font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface">
          skip for now — you can set this up later in Autopilot
        </button>
      </div>
    )
  }

  // ── Step 3: add writing + build (content scrolls; bar + button pinned at bottom) ──
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <div className="flex-1 px-margin-mobile pt-12 pb-4">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Stepper step={3} />
        <button
          type="button"
          onClick={() => { setError(''); setStep(2) }}
          className="inline-flex cursor-pointer items-center gap-1 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back
        </button>
      </div>

      <h1 className="mb-2 font-headline-xl text-headline-xl">Add a few things you’ve written</h1>
      <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
        A couple of posts or a paragraph or two is plenty. We’ll learn your style and build “{displayName}”.
      </p>

      {error && <p className="mb-4 font-body-sm text-body-sm text-error">{error}</p>}

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border-muted bg-surface-container-low p-4">
        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-border-muted bg-surface-container-lowest p-1">
          <button
            type="button"
            onClick={() => { setMode('paste'); setDraft('') }}
            aria-pressed={mode === 'paste'}
            className={`cursor-pointer rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors ${mode === 'paste' ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Paste text
          </button>
          <button
            type="button"
            onClick={() => { setMode('url'); setDraft('') }}
            aria-pressed={mode === 'url'}
            className={`cursor-pointer rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors ${mode === 'url' ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Add a link
          </button>
        </div>

        {mode === 'paste' ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a few of your posts, or a paragraph or two you’ve written…"
            className="h-32 w-full resize-none rounded-lg border border-border-muted bg-surface-container-lowest p-3 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none focus:ring-2 focus:ring-electric-indigo/30"
          />
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://… an X post, blog, or page you wrote"
            className="w-full rounded-lg border border-border-muted bg-surface-container-lowest p-3 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none focus:ring-2 focus:ring-electric-indigo/30"
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAdd}
            disabled={busy || !draft.trim()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <><Spinner size={16} /> Adding…</> : 'Add'}
          </button>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files) }}
            className={`flex-1 rounded-lg border border-dashed px-3 py-2.5 text-center font-code-label text-code-label transition-colors ${dragOver ? 'border-electric-indigo bg-electric-indigo/5 text-on-surface' : 'border-border-muted text-on-surface-variant/70'}`}
          >
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex cursor-pointer items-center gap-1.5 hover:text-on-surface">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">upload_file</span>
              or drop a file
            </button>
            <input ref={fileRef} type="file" multiple accept=".txt,.md,.markdown,text/*" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
          </div>
        </div>
      </div>

      {/* samples / empty — no raw word counts */}
      {samples.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          {samples.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-border-muted bg-surface-container-low p-3">
              <div className="min-w-0 flex-1">
                <span className="mb-1 inline-block rounded-full bg-surface-container-high px-2 py-0.5 font-code-label text-[10px] uppercase tracking-wide text-on-surface-variant/70">{SOURCE_LABEL[s.source]}</span>
                <p className="line-clamp-2 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface-variant">{s.text}</p>
              </div>
              <button type="button" onClick={() => onDelete(s.id)} aria-label="Delete sample" className="shrink-0 cursor-pointer text-on-surface-variant/60 transition-colors hover:text-error">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-4 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border-muted bg-surface-container-lowest px-4 py-8 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[28px] text-on-surface-variant/40">draw</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Nothing added yet — paste a post above.</p>
        </div>
      )}

      {creatorLink}
      </div>

      {/* Sticky footer — the "min 150 words" bar + build button stay pinned to the
          bottom of the screen while the content above scrolls. */}
      <div className="sticky bottom-0 border-t border-border-muted bg-surface/90 px-margin-mobile py-4 backdrop-blur-sm">
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between font-code-label text-code-label">
            <span className={enough ? 'text-cyber-lime' : 'text-on-surface-variant'}>min 150 words</span>
            <span className={`tabular-nums ${enough ? 'text-cyber-lime' : 'text-on-surface-variant/60'}`}>
              {totalWords} {totalWords === 1 ? 'word' : 'words'}{enough ? ' · ✓ ready' : ''}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="progress toward minimum 150 words"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${enough ? 'bg-cyber-lime' : 'bg-electric-indigo'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onBuild}
          disabled={!enough || continuing}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-cyber-lime px-6 py-3 font-bold text-charcoal-black transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {continuing ? <><Spinner size={18} /> Building your voice…</> : enough ? 'Build my voice' : 'Add a bit more to continue'}
        </button>
      </div>
    </div>
  )
}
