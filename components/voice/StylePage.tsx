'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import {
  addSample,
  deleteSample as apiDeleteSample,
  generateStyleGuide,
  saveStyleGuide,
  toggleSample as apiToggleSample,
} from '@/lib/voice/client'
import type { VoiceProfile, WritingSample } from '@/lib/voice/types'

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

type AddMode = null | 'paste' | 'url'

export function StylePage({ profile, initialSamples, onboarding = false }: { profile: VoiceProfile; initialSamples: WritingSample[]; onboarding?: boolean }) {
  const router = useRouter()
  const [samples, setSamples] = useState<WritingSample[]>(initialSamples)
  const [guide, setGuide] = useState(profile.styleGuide)
  const [summary, setSummary] = useState(profile.styleSummary)

  const [addMode, setAddMode] = useState<AddMode>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [importing, setImporting] = useState(false)

  const [panelOpen, setPanelOpen] = useState(false)
  const [guideDraft, setGuideDraft] = useState('')
  const [savingGuide, setSavingGuide] = useState(false)

  // Close the full-guide dialog on Escape.
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanelOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panelOpen])

  const enabledCount = samples.filter((s) => s.usedInStyle).length

  async function submitAdd(source: 'paste' | 'url') {
    setError('')
    const val = draft.trim()
    if (!val) return
    setAdding(true)
    try {
      const { sample } = await addSample(profile.id, source === 'url' ? { source: 'url', url: val } : { source: 'paste', text: val })
      setSamples((s) => [sample, ...s])
      setDraft('')
      setAddMode(null)
      if (guide) setStale(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that.')
    } finally {
      setAdding(false)
    }
  }

  async function onUpload(file: File) {
    setError('')
    setAdding(true)
    try {
      const text = (await file.text()).trim()
      if (!text) throw new Error('That file looks empty.')
      const { sample } = await addSample(profile.id, { source: 'upload', text })
      setSamples((s) => [sample, ...s])
      if (guide) setStale(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setAdding(false)
    }
  }

  async function importFromX() {
    setError('')
    setImporting(true)
    try {
      const res = await fetch('/api/x/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(res.status === 409 ? data.error ?? 'Connect your X account in Profile first.' : data.error ?? 'Could not import.')
        return
      }
      const added: WritingSample[] = data.samples ?? []
      setSamples((s) => [...added, ...s])
      if (guide && added.length) setStale(true)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setImporting(false)
    }
  }

  async function onToggle(id: string, used: boolean) {
    setSamples((s) => s.map((x) => (x.id === id ? { ...x, usedInStyle: used } : x)))
    try {
      await apiToggleSample(profile.id, id, used)
      if (guide) setStale(true)
    } catch {
      setSamples((s) => s.map((x) => (x.id === id ? { ...x, usedInStyle: !used } : x)))
    }
  }

  async function onDelete(id: string) {
    const prev = samples
    setSamples((s) => s.filter((x) => x.id !== id))
    try {
      await apiDeleteSample(profile.id, id)
      if (guide) setStale(true)
    } catch {
      setSamples(prev)
    }
  }

  async function onGenerate() {
    setError('')
    setGenBusy(true)
    try {
      const { profile: updated } = await generateStyleGuide(profile.id)
      // First-time generation during onboarding makes this voice ready → into the app.
      if (onboarding) {
        router.push('/app')
        router.refresh()
        return
      }
      setGuide(updated.styleGuide)
      setSummary(updated.styleSummary)
      setStale(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the guide.')
    } finally {
      setGenBusy(false)
    }
  }

  async function onSaveGuide() {
    setSavingGuide(true)
    try {
      const { profile: updated } = await saveStyleGuide(profile.id, { guideMarkdown: guideDraft })
      setGuide(updated.styleGuide)
      setSummary(updated.styleSummary)
      setPanelOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the guide.')
    } finally {
      setSavingGuide(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* breadcrumb + title — during onboarding the root returns to setup, not the library */}
      <div className="mb-1 flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
        {onboarding ? (
          <Link href="/app/onboarding" className="inline-flex items-center gap-1 hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to setup
          </Link>
        ) : (
          <Link href="/app/voices" className="hover:text-on-surface">
            Voices
          </Link>
        )}
        <span aria-hidden="true">›</span>
        <span className="text-on-surface">{profile.name}</span>
      </div>
      <h1 className="mb-5 font-headline-xl text-headline-xl">{profile.name}</h1>

      {/* connections */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/app/profile"
          className="inline-flex items-center gap-2 rounded-full border border-border-muted px-4 py-1.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:border-electric-indigo hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[16px]">link</span> Connect X
        </Link>
      </div>

      {error && <p className="mb-4 font-body-sm text-body-sm text-error">{error}</p>}

      {/* add reference */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border-muted bg-surface-container-low p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-code-label text-code-label uppercase text-on-surface-variant">Add reference</span>
          <button
            type="button"
            onClick={() => { setAddMode(addMode === 'paste' ? null : 'paste'); setDraft('') }}
            className="rounded-full border border-border-muted px-3 py-1 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo"
          >
            Paste text
          </button>
          <label className="cursor-pointer rounded-full border border-border-muted px-3 py-1 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo">
            Upload
            <input
              type="file"
              accept=".txt,.md,.markdown,text/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }}
            />
          </label>
          <button
            type="button"
            onClick={() => { setAddMode(addMode === 'url' ? null : 'url'); setDraft('') }}
            className="rounded-full border border-border-muted px-3 py-1 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo"
          >
            Add URL
          </button>
          <button
            type="button"
            onClick={importFromX}
            disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-muted px-3 py-1 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo disabled:opacity-60"
          >
            {importing ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">download</span>}
            {importing ? 'Importing…' : 'Import from X'}
          </button>
        </div>

        {addMode && (
          <div className="flex flex-col gap-2">
            {addMode === 'paste' ? (
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
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => submitAdd(addMode)}
                disabled={adding || !draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-1.5 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {adding ? <><Spinner size={16} /> Adding…</> : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* samples grid */}
      <h2 className="mb-3 font-code-label text-code-label uppercase tracking-widest text-on-surface-variant">
        Writing examples ({samples.length})
      </h2>
      {samples.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-dashed border-border-muted py-12 text-center font-body-sm text-body-sm text-on-surface-variant/60">
          This voice needs samples. Import from X, paste text, upload a file, or add a URL — then
          generate the Style Guide to start writing in this voice.
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {samples.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-2xl border border-border-muted bg-surface-container-low p-4">
              <p className="line-clamp-4 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface-variant">{s.text}</p>
              <div className="mt-auto flex items-center justify-between border-t border-border-muted pt-3">
                <label className="flex cursor-pointer items-center gap-2 font-code-label text-code-label text-on-surface-variant">
                  <input type="checkbox" checked={s.usedInStyle} onChange={(e) => onToggle(s.id, e.target.checked)} className="accent-cyber-lime" />
                  used in style
                </label>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-border-muted px-2 py-0.5 font-code-label text-[10px] uppercase text-on-surface-variant/60">{s.source}</span>
                  <button onClick={() => onDelete(s.id)} className="text-on-surface-variant transition-colors hover:text-error" aria-label="Delete sample">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* style guide */}
      <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-code-label text-code-label uppercase tracking-widest text-electric-indigo">Style guide</h2>
          {guide && <span className="font-code-label text-code-label text-on-surface-variant/60">{wordCount(guide)} words</span>}
        </div>

        {stale && guide && (
          <p className="mb-3 rounded-lg border border-cyber-lime/30 bg-cyber-lime/5 px-3 py-2 font-code-label text-code-label text-cyber-lime">
            Samples changed — the guide may be stale. Regenerate to refresh it.
          </p>
        )}

        {guide ? (
          <>
            <p className="mb-4 font-body-md text-body-md text-on-surface">{summary}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => { setGuideDraft(guide); setPanelOpen(true) }}
                className="rounded-full border border-border-muted px-5 py-2 font-bold text-on-surface transition-colors hover:border-electric-indigo"
              >
                View full guide
              </button>
              <button
                type="button"
                onClick={onGenerate}
                disabled={genBusy || enabledCount === 0 || !stale}
                title={!stale ? 'Add or change a writing sample first — nothing new to learn from yet' : undefined}
                className="inline-flex items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {genBusy ? <><Spinner size={16} /> Analyzing…</> : 'Regenerate'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Generate a Style Guide from your enabled samples ({enabledCount}). It captures your sentence rhythm,
              punctuation, vocabulary, and tone — and drives every post we write for you.
            </p>
            <button
              type="button"
              onClick={onGenerate}
              disabled={genBusy || enabledCount === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-electric-indigo px-6 py-2.5 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
            >
              {genBusy ? <><Spinner size={16} /> Analyzing…</> : 'Generate Style Guide'}
            </button>
          </div>
        )}
      </div>

      {/* full guide editable panel */}
      {panelOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="guide-dialog-title" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button aria-label="Close" onClick={() => setPanelOpen(false)} className="absolute inset-0 bg-charcoal-black/70 backdrop-blur-sm" />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-border-muted bg-surface p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="guide-dialog-title" className="font-headline-lg text-headline-lg">Style guide</h3>
              <span className="font-code-label text-code-label text-on-surface-variant/60">{wordCount(guideDraft)} words</span>
            </div>
            <textarea
              autoFocus
              value={guideDraft}
              onChange={(e) => setGuideDraft(e.target.value)}
              aria-label="Edit style guide"
              className="mb-4 h-[55vh] w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-sm leading-relaxed text-on-surface focus:border-electric-indigo focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setPanelOpen(false)} className="rounded-full px-5 py-2 font-code-label text-code-label text-on-surface-variant hover:text-on-surface">
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveGuide}
                disabled={savingGuide || !guideDraft.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-electric-indigo px-6 py-2 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {savingGuide ? <><Spinner size={16} /> Saving…</> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
