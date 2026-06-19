'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { ImageLightbox } from '@/components/app/ImageLightbox'
import { useCredits } from '@/components/app/CreditsContext'
import { COST_PER_AI_PHOTO, COST_PER_PHOTO_SEARCH, fmtCredits } from '@/lib/creditsConfig'

export type DraftImage = { url: string; source: 'ai' | 'stock' | 'upload'; alt?: string }

// X allows up to 4 images per post; we cap at that for both destinations.
const MAX_IMAGES = 4

type Pane = 'ai' | 'search' | 'upload' | null
type StockResult = {
  id: string
  thumbUrl: string
  fullUrl: string
  downloadLocation: string
  alt: string
  photographer: string
  photographerUrl: string
}

// The 3 image controls (AI / search / upload) + popovers + the attached thumbnail.
// All flows end the same way: an image lands in Blob and we report its URL via
// onChange. Credit checks/deductions happen server-side; on 402 we surface the
// existing insufficient-credits flow via onInsufficient.
export function DraftImageControls({
  draftText,
  images,
  onChange,
  onInsufficient,
}: {
  draftText: string
  images: DraftImage[]
  onChange: (imgs: DraftImage[]) => void
  onInsufficient: () => void
}) {
  const { setBalance } = useCredits()
  const [pane, setPane] = useState<Pane>(null)
  const [zoom, setZoom] = useState<DraftImage | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const full = images.length >= MAX_IMAGES

  // Close the open popover on an outside click or Escape.
  useEffect(() => {
    if (!pane) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPane(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPane(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pane])

  // Append the new image (one per pick); cap at MAX_IMAGES.
  function attach(img: DraftImage, creditsLeft?: number) {
    if (typeof creditsLeft === 'number') setBalance(creditsLeft)
    onChange([...images, img].slice(0, MAX_IMAGES))
    setPane(null)
  }
  function removeAt(i: number) {
    onChange(images.filter((_, idx) => idx !== i))
  }

  const toggle = (p: Exclude<Pane, null>) => setPane((cur) => (cur === p ? null : p))

  return (
    <div className="mt-3">
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={`${img.url}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt || ''}
                onClick={() => setZoom(img)}
                title="Click to view full screen"
                className="size-24 cursor-zoom-in rounded-xl border border-border-muted object-cover transition-opacity hover:opacity-90"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove image"
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border-muted bg-surface-container-high text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <span aria-hidden className="material-symbols-outlined text-[15px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {zoom && <ImageLightbox src={zoom.url} alt={zoom.alt} onClose={() => setZoom(null)} />}

      <div ref={wrapRef} className="relative flex items-center justify-end gap-1.5">
        {full ? (
          <span className="font-code-label text-code-label text-on-surface-variant/60">Max {MAX_IMAGES} images</span>
        ) : (
          <>
            <IconButton icon="auto_awesome" label="AI image" active={pane === 'ai'} onClick={() => toggle('ai')} />
            <IconButton icon="image_search" label="Search photo" active={pane === 'search'} onClick={() => toggle('search')} />
            <IconButton icon="attach_file" label="Upload image" active={pane === 'upload'} onClick={() => toggle('upload')} />
          </>
        )}

        {pane === 'ai' && <AiPane draftText={draftText} onAttach={attach} onInsufficient={onInsufficient} />}
        {pane === 'search' && <SearchPane onAttach={attach} onInsufficient={onInsufficient} />}
        {pane === 'upload' && <UploadPane onAttach={attach} />}
      </div>
    </div>
  )
}

function IconButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex size-8 items-center justify-center rounded-full border transition-colors ${
        active ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface' : 'border-border-muted text-on-surface-variant hover:text-on-surface'
      }`}
    >
      <span aria-hidden className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  )
}

// Shared popover shell, anchored above the button row, right-aligned.
function Popover({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full right-0 z-20 mb-2 w-80 rounded-xl border border-border-muted bg-surface-container-high p-3 shadow-xl">
      {children}
    </div>
  )
}

function AiPane({ draftText, onAttach, onInsufficient }: { draftText: string; onAttach: (img: DraftImage, creditsLeft?: number) => void; onInsufficient: () => void }) {
  const [prompt, setPrompt] = useState(draftText.slice(0, 400))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (!prompt.trim() || busy) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 402 && data.insufficientCredits) return void onInsufficient()
      if (!res.ok) return void setError(data.error ?? "Couldn't generate that image.")
      onAttach({ url: data.url, source: 'ai' }, data.creditsLeft)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover>
      <p className="mb-2 font-code-label text-code-label uppercase text-on-surface-variant">AI image · {fmtCredits(COST_PER_AI_PHOTO)} cr</p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="Describe the image…"
        className="w-full resize-none rounded-lg border border-border-muted bg-surface-container-lowest p-2 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none"
      />
      {error && <p className="mt-1 font-code-label text-code-label text-error">{error}</p>}
      <button
        type="button"
        onClick={generate}
        disabled={busy || !prompt.trim()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
      >
        {busy ? <><Spinner size={14} /> Generating…</> : 'Generate'}
      </button>
    </Popover>
  )
}

function SearchPane({ onAttach, onInsufficient }: { onAttach: (img: DraftImage, creditsLeft?: number) => void; onInsufficient: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<StockResult[]>([])
  const [searching, setSearching] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function search(e?: React.FormEvent) {
    e?.preventDefault()
    if (!q.trim() || searching) return
    setError('')
    setSearching(true)
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return void setError(data.error ?? "Couldn't search photos.")
      setResults(data.results ?? [])
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSearching(false)
    }
  }

  async function pick(r: StockResult) {
    if (pickingId) return
    setError('')
    setPickingId(r.id)
    try {
      const res = await fetch('/api/images/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullUrl: r.fullUrl, downloadLocation: r.downloadLocation, photographer: r.photographer, photographerUrl: r.photographerUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 402 && data.insufficientCredits) return void onInsufficient()
      if (!res.ok) return void setError(data.error ?? "Couldn't attach that photo.")
      onAttach({ url: data.url, source: 'stock', alt: data.alt }, data.creditsLeft)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setPickingId(null)
    }
  }

  return (
    <Popover>
      <p className="mb-2 font-code-label text-code-label uppercase text-on-surface-variant">Stock photo · {fmtCredits(COST_PER_PHOTO_SEARCH)} cr to pick</p>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search photos…"
          className="min-w-0 flex-1 rounded-lg border border-border-muted bg-surface-container-lowest px-2 py-1.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none"
        />
        <button type="submit" disabled={searching || !q.trim()} className="flex items-center rounded-full border border-border-muted px-3 py-1.5 text-on-surface-variant hover:text-on-surface disabled:opacity-50">
          {searching ? <Spinner size={14} /> : <span aria-hidden className="material-symbols-outlined text-[16px]">search</span>}
        </button>
      </form>
      {error && <p className="mt-1 font-code-label text-code-label text-error">{error}</p>}
      {results.length > 0 && (
        <div className="mt-2 grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto">
          {results.map((r) => (
            <button key={r.id} type="button" onClick={() => pick(r)} disabled={pickingId !== null} className="relative aspect-square overflow-hidden rounded-md border border-border-muted disabled:opacity-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumbUrl} alt={r.alt} className="size-full object-cover" />
              {pickingId === r.id && <span className="absolute inset-0 flex items-center justify-center bg-black/50"><Spinner size={16} /></span>}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

function UploadPane({ onAttach }: { onAttach: (img: DraftImage, creditsLeft?: number) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return void setError('Use a PNG, JPEG, or WebP image.')
    if (file.size > 5 * 1024 * 1024) return void setError('Image must be 5MB or smaller.')
    setError('')
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/images/upload', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return void setError(data.error ?? "Couldn't upload that image.")
      onAttach({ url: data.url, source: 'upload' })
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover>
      <p className="mb-2 font-code-label text-code-label uppercase text-on-surface-variant">Upload · free</p>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-muted px-4 py-6 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:border-electric-indigo hover:text-on-surface disabled:opacity-60"
      >
        {busy ? <><Spinner size={14} /> Uploading…</> : <><span aria-hidden className="material-symbols-outlined text-[18px]">upload</span> Choose an image (PNG/JPEG/WebP, ≤5MB)</>}
      </button>
      {error && <p className="mt-1 font-code-label text-code-label text-error">{error}</p>}
    </Popover>
  )
}
