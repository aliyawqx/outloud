'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { UpgradeModal } from '@/components/app/UpgradeModal'
import { useCredits } from '@/components/app/CreditsContext'
import { GenerationStatus, type FeedStep } from '@/components/app/GenerationStatus'
import { DraftImageControls, type DraftImage } from '@/components/app/DraftImageControls'
import { ScheduleModal } from '@/components/app/ScheduleModal'
import type { ChatTurnRecord, DraftPost } from '@/lib/voice/types'
import type { ComposeEvent, DoneEvent } from '@/lib/compose/stream'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type VoiceOption = { id: string; name: string; isActive: boolean }

// The platforms a generated post can be published to. The SAME text goes to each
// selected, connected platform — no per-platform rewrite.
type Dest = 'x' | 'threads' | 'linkedin'
const DESTINATIONS: { key: Dest; label: string; endpoint: string }[] = [
  { key: 'x', label: 'X', endpoint: '/api/x/publish' },
  { key: 'threads', label: 'Threads', endpoint: '/api/threads/publish' },
  { key: 'linkedin', label: 'LinkedIn', endpoint: '/api/linkedin/publish' },
]

function DraftCard({
  draft,
  index,
  xConnected,
  threadsConnected,
  linkedInConnected,
  onInsufficient,
  onImagesChange,
  onTextChange,
}: {
  draft: DraftPost
  index: number
  xConnected: boolean
  threadsConnected: boolean
  linkedInConnected: boolean
  onInsufficient: () => void
  onImagesChange?: (imgs: DraftImage[]) => void
  onTextChange?: (text: string) => void
}) {
  const router = useRouter()
  const [text, setText] = useState(draft.fullText)
  const [editing, setEditing] = useState(false)

  // Finishing an edit ("Done" or blurring the textarea) persists the new text to the
  // saved chat so it survives a reload — without this, a reload restores the original.
  function finishEdit() {
    if (text !== draft.fullText) {
      onTextChange?.(text)
      // The schedule confirmation refers to the content at schedule time — edits clear it.
      setScheduledFor(null)
    }
  }
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduledFor, setScheduledFor] = useState<string | null>(null)
  // One optional image per draft (AI / stock / upload), attached client-side and
  // sent to the publishers. Seeded from the draft in case it was ever persisted.
  const [images, setImages] = useState<DraftImage[]>(
    draft.images && draft.images.length
      ? draft.images
      : draft.imageUrl // migrate a legacy single-image draft
        ? [{ url: draft.imageUrl, source: draft.imageSource ?? 'upload', alt: draft.imageAlt }]
        : [],
  )
  // Update local state AND lift to the parent so the images persist to history
  // (survive reload) and aren't wiped by a later full re-save of the chat.
  function changeImages(imgs: DraftImage[]) {
    setImages(imgs)
    onImagesChange?.(imgs)
    // The schedule confirmation refers to the content at schedule time — image changes clear it.
    setScheduledFor(null)
  }
  // Per-platform outcome after a publish attempt (url on success, error on failure).
  const [results, setResults] = useState<Partial<Record<Dest, { url?: string; error?: string; note?: string }>>>({})

  const connected: Record<Dest, boolean> = { x: xConnected, threads: threadsConnected, linkedin: linkedInConnected }
  // Pre-select every connected platform; the user can toggle any off before publishing.
  const [selected, setSelected] = useState<Record<Dest, boolean>>({
    x: xConnected,
    threads: threadsConnected,
    linkedin: linkedInConnected,
  })

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function toggle(key: Dest) {
    if (!connected[key]) return
    setSelected((s) => ({ ...s, [key]: !s[key] }))
  }

  async function publishTo(d: (typeof DESTINATIONS)[number]): Promise<[Dest, { url?: string; error?: string; note?: string }]> {
    try {
      const res = await fetch(d.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrls: images.map((i) => i.url), imageAlts: images.map((i) => i.alt ?? '') }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const error = res.status === 409 ? (data.error ?? `Connect your ${d.label} account in Profile first.`) : data.error ?? 'Could not publish.'
        return [d.key, { error }]
      }
      // Posted, but the image couldn't go to X (image posting needs a paid X tier).
      const note = images.length && data.imageSkipped ? 'image not added — X image posting isn’t enabled' : undefined
      return [d.key, { url: data.url, note }]
    } catch {
      return [d.key, { error: 'Network error. Try again.' }]
    }
  }

  const chosen = DESTINATIONS.filter((d) => connected[d.key] && selected[d.key])

  async function publish() {
    if (chosen.length === 0) return
    setResults({})
    setPublishing(true)
    try {
      const settled = await Promise.all(chosen.map(publishTo))
      setResults(Object.fromEntries(settled))
    } finally {
      setPublishing(false)
    }
  }

  const noneConnected = !xConnected && !threadsConnected && !linkedInConnected

  return (
    <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-code-label text-code-label uppercase tracking-wide text-on-surface-variant">
          Draft {index + 1}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => { if (editing) finishEdit(); setEditing((e) => !e) }} aria-pressed={editing} className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface">
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
          onBlur={finishEdit}
          className="h-56 w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md leading-relaxed text-on-surface focus:border-electric-indigo focus:outline-none"
        />
      ) : (
        <p className="whitespace-pre-wrap font-body-md leading-relaxed text-on-surface">{text}</p>
      )}

      {/* Images: AI / stock search / upload — up to 4 per draft, sent with the post. */}
      <DraftImageControls draftText={text} images={images} onChange={changeImages} onInsufficient={onInsufficient} />

      {/* Destination selector: same text to each selected, connected platform. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant/70">Post to</span>
        {DESTINATIONS.map((d) => {
          const isConnected = connected[d.key]
          const on = isConnected && selected[d.key]
          return (
            <button
              key={d.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={d.label}
              disabled={!isConnected}
              onClick={() => toggle(d.key)}
              title={isConnected ? undefined : `Connect ${d.label} in Profile to enable`}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-code-label text-code-label transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                on
                  ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface'
                  : 'border-border-muted text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{on ? 'check_circle' : 'radio_button_unchecked'}</span>
              {d.label}
            </button>
          )
        })}
      </div>
      {noneConnected ? (
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          Connect X, Threads or LinkedIn in <a href="/app/profile" className="text-electric-indigo hover:underline">Profile</a> to publish.
        </p>
      ) : (
        (!xConnected || !threadsConnected || !linkedInConnected) && (
          <p className="mt-2 font-code-label text-code-label text-on-surface-variant/60">
            Connect {DESTINATIONS.filter((d) => !connected[d.key]).map((d) => d.label).join(' and ')} in{' '}
            <a href="/app/profile" className="text-electric-indigo hover:underline">Profile</a> to post there too.
          </p>
        )
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          data-tour="publish"
          onClick={publish}
          disabled={publishing || !text.trim() || chosen.length === 0}
          className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
        >
          {publishing ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">send</span>}
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
        <button
          type="button"
          data-tour="schedule"
          onClick={() => setScheduleOpen(true)}
          disabled={publishing || !text.trim() || chosen.length === 0}
          className="flex items-center gap-1.5 rounded-full border border-electric-indigo/60 px-4 py-2 font-code-label text-code-label text-electric-indigo transition-all hover:bg-electric-indigo/10 active:scale-95 disabled:opacity-60"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">event</span>
          Schedule
        </button>
        <span className="font-code-label text-code-label text-on-surface-variant/60">{text.length} chars</span>
      </div>

      {/* Per-platform outcomes. */}
      <div className="mt-2 flex flex-col gap-1">
        {DESTINATIONS.map((d) => {
          const r = results[d.key]
          if (!r) return null
          return r.url ? (
            <div key={d.key} className="flex flex-col">
              <a href={r.url} target="_blank" rel="noreferrer" className="font-code-label text-code-label text-cyber-lime hover:underline">
                View on {d.label} →
              </a>
              {r.note && <span className="font-code-label text-code-label text-on-surface-variant/70">{r.note}</span>}
            </div>
          ) : (
            <p key={d.key} className="font-body-sm text-body-sm text-error">{d.label}: {r.error}</p>
          )
        })}
      </div>

      {scheduledFor && (
        <div className="mt-3 flex flex-col gap-1 rounded-xl border border-cyber-lime/30 bg-cyber-lime/5 p-3">
          <p className="font-body-sm text-body-sm text-on-surface">
            scheduled for {new Date(scheduledFor).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — it&apos;s on your calendar.
          </p>
          <a href="/app/calendar" className="font-code-label text-code-label text-cyber-lime hover:underline">
            View calendar →
          </a>
        </div>
      )}

      {scheduleOpen && (
        <ScheduleModal
          text={text}
          images={images}
          platforms={chosen.map((d) => d.key)}
          onClose={() => setScheduleOpen(false)}
          onScheduled={(when) => {
            setScheduleOpen(false)
            setScheduledFor(when)
          }}
        />
      )}

      {/* Post-publish nudge: each post should live in its own chat, so credits go to
          drafting rather than carrying old context. Non-blocking. */}
      {Object.values(results).some((r) => r?.url) && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-electric-indigo/30 bg-electric-indigo/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            posted! start a new chat for your next post — keeps your credits on drafting, not old context.
          </p>
          <button
            type="button"
            onClick={() => { router.push('/app'); router.refresh() }}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label font-bold text-white transition-colors hover:bg-primary-container active:scale-95 sm:self-auto"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>
            New post
          </button>
        </div>
      )}
    </div>
  )
}

type Turn =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; options?: string[] }
  | { id: number; role: 'assistant'; draft: DraftPost }

export type ComposeSession = { historyId: string; voiceId?: string; turns: ChatTurnRecord[] }
type CommandOption = { command: string; title: string }

export function ComposeHome({
  name,
  voices,
  commands = [],
  initialSession,
  xConnected = false,
  threadsConnected = false,
  linkedInConnected = false,
}: {
  name: string
  voices: VoiceOption[]
  commands?: CommandOption[]
  initialSession?: ComposeSession
  xConnected?: boolean
  threadsConnected?: boolean
  linkedInConnected?: boolean
}) {
  const router = useRouter()
  const active = voices.find((v) => v.isActive) ?? voices[0]
  const initialTurns: Turn[] = (initialSession?.turns ?? []).map(
    (t, i) =>
      ('draft' in t
        ? { id: i, role: 'assistant', draft: t.draft }
        : { id: i, role: t.role, text: t.text, ...('options' in t && t.options ? { options: t.options } : {}) }) as Turn,
  )
  const [voiceId, setVoiceId] = useState(initialSession?.voiceId ?? active?.id ?? '')
  const [turns, setTurns] = useState<Turn[]>(initialTurns)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [genSteps, setGenSteps] = useState<FeedStep[]>([])
  const stepCounter = useRef(0)
  const [error, setError] = useState('')
  const [historyId, setHistoryId] = useState<string | undefined>(initialSession?.historyId)
  const [activeCommand, setActiveCommand] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const { setBalance } = useCredits() // live header balance, reconciled from each response
  // Highlights the suggested option the user tapped (the input below stays available
  // the whole time — tapping an option is just a shortcut for typing the answer).
  const [pickedOption, setPickedOption] = useState<string | null>(null)

  // Auto-grow the input with its content, up to ~3 rows (then it scrolls). The
  // max height comes from the textarea's CSS max-h; we just track scrollHeight.
  const taRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

  // Slash menu: open while the input is just "/" or "/partial" (no space yet).
  const slashMatch = input.match(/^\/([a-z0-9-]*)$/i)
  const menuItems = slashMatch ? commands.filter((c) => c.command.startsWith(slashMatch[1].toLowerCase())) : []
  const menuOpen = Boolean(slashMatch) && menuItems.length > 0

  function pickCommand(command: string) {
    setActiveCommand(command)
    setInput('')
  }

  const started = turns.length > 0
  const counter = useState(() => ({ n: initialTurns.length }))[0]
  const id = () => ++counter.n

  // Serialize the visible turns (+ the new user message) into restorable records,
  // which the server uses both to run the chat and to persist the transcript.
  function toRecords(extra: Turn): ChatTurnRecord[] {
    return [...turns, extra].map(
      (t) =>
        ('draft' in t
          ? { role: 'assistant', draft: t.draft }
          : { role: t.role, text: t.text, ...('options' in t && t.options ? { options: t.options } : {}) }) as ChatTurnRecord,
    )
  }

  async function send(override?: string) {
    let text = (override ?? input).trim()
    if (!text || loading) return
    // Bare "/command" → just select the format, don't send yet (typed input only).
    if (override === undefined) {
      const bare = text.match(/^\/([a-z0-9-]+)$/i)
      if (bare && commands.some((c) => c.command === bare[1].toLowerCase())) {
        pickCommand(bare[1].toLowerCase())
        return
      }
    }
    setError('')
    let command = activeCommand || undefined
    // Inline "/command rest of idea" → use that command for this message.
    const inline = text.match(/^\/([a-z0-9-]+)\s+([\s\S]+)$/i)
    if (inline && commands.some((c) => c.command === inline[1].toLowerCase())) {
      command = inline[1].toLowerCase()
      setActiveCommand(command)
      text = inline[2].trim()
    }
    const userTurn: Turn = { id: id(), role: 'user', text }
    const turnsPayload = toRecords(userTurn)
    setTurns((t) => [...t, userTurn])
    setInput('')
    setLoading(true)
    setGenSteps([]) // fresh feed each generation (also resets a prior error line)
    try {
      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: turnsPayload, profileId: voiceId || undefined, historyId, command }),
      })

      // Pre-stream failures (auth/credits/voice) arrive as plain JSON with a code.
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409 && data.needsVoice) return void router.push('/app/onboarding')
        if (res.status === 402 && data.insufficientCredits) return void setShowUpgrade(true)
        setError(data.error ?? "Couldn't write that. Try again.")
        return
      }

      // Live status stream. Pace steps so each stays visible ≥250ms (no flicker),
      // then a terminal `done` reveals the post (or `error` turns the last line red).
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let lastShown = 0
      const pace = async () => {
        const wait = 250 - (Date.now() - lastShown)
        if (lastShown && wait > 0) await sleep(wait)
        lastShown = Date.now()
      }
      const pushStep = (step: FeedStep['step'], label: string, tag: string | undefined, state: FeedStep['state']) =>
        setGenSteps((prev) => [
          ...prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s)),
          { id: String(++stepCounter.current), step, label, tag, state },
        ])

      let done: DoneEvent | null = null
      for (;;) {
        const { value, done: streamDone } = await reader.read()
        if (streamDone) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          let ev: ComposeEvent
          try {
            ev = JSON.parse(line.slice(5).trim()) as ComposeEvent
          } catch {
            continue
          }
          if (ev.type === 'status') {
            await pace()
            pushStep(ev.step, ev.label, ev.tag, 'active')
          } else if (ev.type === 'done') {
            done = ev
          } else if (ev.type === 'error') {
            await pace()
            pushStep('error', ev.error, undefined, 'error') // last line turns red, persists
            if (ev.needsVoice) return void router.push('/app/onboarding')
            if (ev.insufficientCredits) return void setShowUpgrade(true)
            return
          }
        }
      }

      if (!done) {
        setGenSteps([])
        setError("Couldn't write that. Try again.")
        return
      }

      // Let the final step breathe, then collapse the feed and reveal the answer.
      await sleep(280)
      setGenSteps([])
      if (typeof done.creditsLeft === 'number') setBalance(done.creditsLeft)
      if (done.historyId) setHistoryId(done.historyId)
      // Anchor a brand-new chat in the URL once it has its first AI answer: the
      // sidebar then lists + highlights it (gray), and "New post" (/app) becomes a
      // clean, separate action that always opens a fresh chat. The remount restores
      // the full transcript (options included) from the server, so nothing is lost.
      if (done.historyId && !initialSession && !historyId) {
        router.replace(`/app?session=${done.historyId}`, { scroll: false })
      }
      if (done.ask) {
        const options = Array.isArray(done.options) ? done.options : []
        setPickedOption(null)
        setTurns((t) => [...t, { id: id(), role: 'assistant', text: done.ask!, options }])
      } else if (done.draft) {
        setTurns((t) => [...t, { id: id(), role: 'assistant', draft: done.draft! }])
      }
    } catch {
      setGenSteps([])
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Tapping a suggested option submits it as the answer to the current question.
  function chooseOption(option: string) {
    if (loading) return
    setPickedOption(option)
    send(option)
  }

  // Show the tappable options only under the latest, still-unanswered question.
  const lastTurn = turns[turns.length - 1]
  const optionsTurn =
    lastTurn && !('draft' in lastTurn) && lastTurn.role === 'assistant' && lastTurn.options && lastTurn.options.length > 0
      ? lastTurn
      : null

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (menuOpen) {
        pickCommand(menuItems[0].command)
        return
      }
      send()
    }
  }

  // Mode + Voice as inline dropdowns in the input toolbar (animated-ai-input style).
  // Empty activeCommand means the default post format.
  const defaultCommand = commands.some((c) => c.command === 'post') ? 'post' : commands[0]?.command ?? ''
  const currentMode = activeCommand || defaultCommand
  const modeTitle = commands.find((c) => c.command === currentMode)?.title ?? 'Mode'
  const triggerClass =
    'flex h-8 items-center gap-1.5 rounded-md px-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface focus-visible:outline-none'

  const modeDropdown = commands.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger data-tour="mode-picker" className={triggerClass} aria-label="Mode">
        <span className="material-symbols-outlined text-[16px] text-electric-indigo">category</span>
        {modeTitle}
        <span className="material-symbols-outlined text-[16px] opacity-50">expand_more</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        {commands.map((c) => (
          <DropdownMenuItem
            key={c.command}
            onSelect={() => setActiveCommand(c.command === defaultCommand ? '' : c.command)}
            className="flex items-center justify-between gap-2"
          >
            {c.title}
            {currentMode === c.command && <span className="material-symbols-outlined text-[16px] text-electric-indigo">check</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const currentVoiceName = voices.find((v) => v.id === voiceId)?.name ?? 'Voice'
  const voiceDropdown = voices.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger data-tour="voice-picker" className={triggerClass} aria-label="Voice">
        <span className="material-symbols-outlined text-[16px] text-electric-indigo">graphic_eq</span>
        {currentVoiceName}
        <span className="material-symbols-outlined text-[16px] opacity-50">expand_more</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        {voices.map((v) => (
          <DropdownMenuItem key={v.id} onSelect={() => setVoiceId(v.id)} className="flex items-center justify-between gap-2">
            <span>{v.name}{v.isActive ? ' (active)' : ''}</span>
            {voiceId === v.id && <span className="material-symbols-outlined text-[16px] text-electric-indigo">check</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const composer = (
    <div className="relative">
      {/* slash command menu */}
      {menuOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-full max-w-md overflow-hidden rounded-xl border border-border-muted bg-surface-container shadow-lg">
          {menuItems.map((c, i) => (
            <button
              key={c.command}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pickCommand(c.command) }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.05] ${i === 0 ? 'bg-white/[0.03]' : ''}`}
            >
              <span className="font-code-label text-code-label text-electric-indigo">/{c.command}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{c.title}</span>
            </button>
          ))}
        </div>
      )}

      <div data-tour="composer" className="rounded-2xl border border-border-muted bg-surface-container-low focus-within:border-electric-indigo/50">
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          aria-label="Message"
          placeholder={started ? 'reply, or ask to tighten / change the hook…' : 'what do you want to post about?  (type / for formats)'}
          className="max-h-[50vh] min-h-[60px] w-full resize-none overflow-y-auto rounded-2xl rounded-b-none bg-transparent px-4 pb-2 pt-4 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
        />
        {/* toolbar: mode + voice dropdowns, send */}
        <div className="flex items-center gap-1 px-2.5 pb-2.5">
          {modeDropdown}
          {modeDropdown && voiceDropdown && <div className="mx-0.5 h-4 w-px bg-white/10" />}
          {voiceDropdown}
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-electric-indigo text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-40"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_upward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!started) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col">
        {/* welcome fills the space above; the composer sits at the bottom like a chat */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-headline-xl text-headline-xl">
            what do you want to post about, <span className="text-electric-indigo">{name}</span>?
          </h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            Type a rough idea. I’ll ask anything I need, then write it in your voice.
          </p>
        </div>
        <div className="sticky bottom-0 -mx-1 bg-surface/80 px-1 pb-2 pt-1 backdrop-blur-sm">
          {composer}
          {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
        </div>
        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      </div>
    )
  }

  // Persist attached/removed images: set them on the matching draft in `turns` (so a
  // later re-save keeps them) and save to the chat's history entry (so they survive a
  // reload). draftIndex is the Nth draft turn, matching the server's transcript order.
  function persistDraftImages(draftIndex: number, imgs: DraftImage[]) {
    setTurns((prev) => {
      let n = 0
      return prev.map((t) => {
        if ('draft' in t) {
          const here = n === draftIndex
          n++
          if (here) return { ...t, draft: { ...t.draft, images: imgs } }
        }
        return t
      })
    })
    if (historyId) {
      fetch('/api/voice/history/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId, draftIndex, images: imgs }),
      }).catch(() => {})
    }
  }

  // Persist an edited draft's text the same way: set it on the matching draft in `turns`
  // (so a later re-save keeps it) and save to history (so it survives a reload).
  function persistDraftText(draftIndex: number, fullText: string) {
    setTurns((prev) => {
      let n = 0
      return prev.map((t) => {
        if ('draft' in t) {
          const here = n === draftIndex
          n++
          if (here) return { ...t, draft: { ...t.draft, fullText } }
        }
        return t
      })
    })
    if (historyId) {
      fetch('/api/voice/history/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId, draftIndex, fullText }),
      }).catch(() => {})
    }
  }

  let draftN = 0
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col">
      <div className="flex flex-1 flex-col gap-4 pb-4">
        {turns.map((t) => {
          if ('draft' in t) {
            const di = draftN++
            return <DraftCard key={t.id} draft={t.draft} index={di} xConnected={xConnected} threadsConnected={threadsConnected} linkedInConnected={linkedInConnected} onInsufficient={() => setShowUpgrade(true)} onImagesChange={(imgs) => persistDraftImages(di, imgs)} onTextChange={(txt) => persistDraftText(di, txt)} />
          }
          if (t.role === 'user') {
            return (
              <div key={t.id} className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-electric-indigo/15 px-4 py-2.5">
                <p className="whitespace-pre-wrap font-body-md text-on-surface">{t.text}</p>
              </div>
            )
          }
          const showOptions = optionsTurn?.id === t.id
          return (
            <div key={t.id} className="flex max-w-[85%] flex-col gap-2 self-start">
              <div className="rounded-2xl rounded-bl-md bg-surface-container-low px-4 py-2.5">
                <p className="whitespace-pre-wrap font-body-md text-on-surface">{t.text}</p>
              </div>
              {showOptions && (
                <div className="flex flex-col gap-2">
                  {t.options!.map((opt) => {
                    const picked = pickedOption === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => chooseOption(opt)}
                        disabled={loading}
                        className={`rounded-xl border px-4 py-2.5 text-left font-body-md transition-colors disabled:opacity-50 ${
                          picked
                            ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface'
                            : 'border-border-muted bg-surface-container-low text-on-surface hover:border-electric-indigo/60 hover:bg-electric-indigo/10'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => taRef.current?.focus()}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-dashed border-border-muted px-4 py-2.5 text-left font-body-md text-on-surface-variant transition-colors hover:border-on-surface-variant hover:text-on-surface disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">edit</span> Write your own
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {/* Live "under the hood" feed once real status events arrive; the static
            line is only a fallback for the brief moment before the first event. */}
        {genSteps.length > 0 ? (
          <GenerationStatus steps={genSteps} />
        ) : (
          loading && (
            <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-surface-container-low px-4 py-2.5 font-code-label text-code-label text-on-surface-variant">
              <Spinner size={16} className="text-electric-indigo" />
              writing in your voice…
            </div>
          )
        )}
      </div>

      <div className="sticky bottom-0 -mx-1 bg-surface/80 px-1 pb-2 pt-1 backdrop-blur-sm">
        {composer}
        {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
      </div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
