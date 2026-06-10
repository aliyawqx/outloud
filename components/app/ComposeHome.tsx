'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { PLANS, PRO_PRICE, STARTER_PRICE, TRIAL_DRAFTS } from '@/lib/pricing'
import { startCheckout } from '@/lib/billing/client'
import type { ChatTurnRecord, DraftPost } from '@/lib/voice/types'

const PRO_PLAN = PLANS.find((p) => p.id === 'pro')
const STARTER_PLAN = PLANS.find((p) => p.id === 'starter')

// Full-screen subscribe wall, shown when a trial user runs out of drafts. Pro is
// the default; a small switcher drops to the cheaper Starter. Checkout is a hosted
// Merchant of Record link (opens in a new tab); internal fallback navigates here.
function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [plan, setPlan] = useState<'pro' | 'starter'>('pro')
  const [busy, setBusy] = useState(false)
  const isPro = plan === 'pro'
  const price = isPro ? PRO_PRICE : STARTER_PRICE
  const features = (isPro ? PRO_PLAN : STARTER_PLAN)?.features ?? []

  async function subscribe() {
    setBusy(true)
    try {
      await startCheckout(plan)
    } catch {
      setBusy(false)
    }
  }

  const pill = (active: boolean) =>
    `rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors ${
      active ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'
    }`

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8">
      {/* the app stays visible behind, blurred */}
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 backdrop-blur-[4px]" />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col items-center gap-6 overflow-y-auto rounded-3xl border border-border-muted bg-surface px-6 py-10 text-center shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/10 hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined">close</span>
        </button>

        <span className="rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-3 py-1 font-code-label text-code-label uppercase tracking-widest text-cyber-lime">
          You’ve used all {TRIAL_DRAFTS} free drafts
        </span>
        <h2 className="font-headline-xl text-headline-xl">Do you want to subscribe?</h2>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Keep writing posts in your own voice. Pick a plan and pick up right where you left off.
        </p>

        {/* plan switcher — Pro is the default, switch down to Starter */}
        <div className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-surface-container-low p-1">
          <button type="button" className={pill(isPro)} onClick={() => setPlan('pro')}>
            Pro · ${PRO_PRICE}/mo
          </button>
          <button type="button" className={pill(!isPro)} onClick={() => setPlan('starter')}>
            Starter · ${STARTER_PRICE}/mo
          </button>
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-electric-indigo bg-surface-container-low p-7 text-left indigo-glow">
          <div className="mb-1 flex items-end gap-1">
            <span className="font-headline-xl text-headline-xl leading-none">${price}</span>
            <span className="mb-1 font-body-md text-body-md text-on-surface-variant">/mo</span>
          </div>
          <p className="mb-5 font-code-label text-code-label text-on-surface-variant">
            {isPro ? 'Pro — everything, unlimited' : 'Starter — for solo builders'}
          </p>
          <ul className="mb-6 space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface">
                <span className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={subscribe}
            disabled={busy}
            className="indigo-glow flex w-full items-center justify-center gap-2 rounded-full bg-electric-indigo px-6 py-3.5 text-lg font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {busy ? <><Spinner size={20} /> Starting…</> : `Subscribe · $${price}/mo`}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}

type VoiceOption = { id: string; name: string; isActive: boolean }

function DraftCard({ draft, index }: { draft: DraftPost; index: number }) {
  const [text, setText] = useState(draft.fullText)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function publish() {
    setPublishError('')
    setPublishedUrl('')
    setPublishing(true)
    try {
      const res = await fetch('/api/x/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPublishError(res.status === 409 ? 'Connect your X account in Profile first.' : data.error ?? 'Could not publish.')
        return
      }
      setPublishedUrl(data.url)
    } catch {
      setPublishError('Network error. Try again.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-code-label text-code-label uppercase tracking-wide text-on-surface-variant">
          Draft {index + 1}
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

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={publishing || !text.trim()}
          className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
        >
          {publishing ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">send</span>}
          {publishing ? 'Publishing…' : 'Publish to X'}
        </button>
        <span className="font-code-label text-code-label text-on-surface-variant/60">{text.length} chars</span>
        {publishedUrl && (
          <a href={publishedUrl} target="_blank" rel="noreferrer" className="font-code-label text-code-label text-cyber-lime hover:underline">
            View on X →
          </a>
        )}
      </div>
      {publishError && <p className="mt-2 font-body-sm text-body-sm text-error">{publishError}</p>}
    </div>
  )
}

type Turn =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string }
  | { id: number; role: 'assistant'; draft: DraftPost }

export type ComposeSession = { historyId: string; voiceId?: string; turns: ChatTurnRecord[] }
type CommandOption = { command: string; title: string }

export function ComposeHome({
  name,
  voices,
  commands = [],
  draftsLeft = null,
  initialSession,
}: {
  name: string
  voices: VoiceOption[]
  commands?: CommandOption[]
  draftsLeft?: number | null
  initialSession?: ComposeSession
}) {
  const router = useRouter()
  const active = voices.find((v) => v.isActive) ?? voices[0]
  const initialTurns: Turn[] = (initialSession?.turns ?? []).map(
    (t, i) => ('draft' in t ? { id: i, role: 'assistant', draft: t.draft } : { id: i, role: t.role, text: t.text }) as Turn,
  )
  const [voiceId, setVoiceId] = useState(initialSession?.voiceId ?? active?.id ?? '')
  const [turns, setTurns] = useState<Turn[]>(initialTurns)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [historyId, setHistoryId] = useState<string | undefined>(initialSession?.historyId)
  const [activeCommand, setActiveCommand] = useState('')
  const [left, setLeft] = useState<number | null>(draftsLeft)
  const [showUpgrade, setShowUpgrade] = useState(false)

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
      (t) => ('draft' in t ? { role: 'assistant', draft: t.draft } : { role: t.role, text: t.text }) as ChatTurnRecord,
    )
  }

  async function send() {
    let text = input.trim()
    if (!text || loading) return
    // Bare "/command" → just select the format, don't send yet.
    const bare = text.match(/^\/([a-z0-9-]+)$/i)
    if (bare && commands.some((c) => c.command === bare[1].toLowerCase())) {
      pickCommand(bare[1].toLowerCase())
      return
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
    try {
      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: turnsPayload, profileId: voiceId || undefined, historyId, command }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.needsVoice) {
        router.push('/app/onboarding')
        return
      }
      if (res.status === 403 && data.limitReached) {
        setLeft(0)
        setShowUpgrade(true) // offer the Pro upgrade instead of a dead-end error
        return
      }
      if (!res.ok) {
        setError(data.error ?? "Couldn't write that. Try again.")
        return
      }
      if (typeof data.draftsLeft === 'number') setLeft(data.draftsLeft)
      if (data.historyId) setHistoryId(data.historyId)
      if (data.ask) {
        setTurns((t) => [...t, { id: id(), role: 'assistant', text: data.ask }])
      } else if (data.draft) {
        setTurns((t) => [...t, { id: id(), role: 'assistant', draft: data.draft }])
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

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

  const voicePicker = voices.length > 0 && (
    <label className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
      Voice
      <select
        value={voiceId}
        onChange={(e) => setVoiceId(e.target.value)}
        aria-label="Voice"
        className="rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none"
      >
        {voices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
            {v.isActive ? ' (active)' : ''}
          </option>
        ))}
      </select>
    </label>
  )

  // The format/mode is normally chosen via the slash menu, but it should always be
  // switchable here too. Empty activeCommand means the default post format.
  const defaultCommand = commands.some((c) => c.command === 'post') ? 'post' : commands[0]?.command ?? ''
  const modePicker = commands.length > 0 && (
    <label className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
      Mode
      <select
        value={activeCommand || defaultCommand}
        onChange={(e) => setActiveCommand(e.target.value === defaultCommand ? '' : e.target.value)}
        aria-label="Mode"
        className="rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none"
      >
        {commands.map((c) => (
          <option key={c.command} value={c.command}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  )

  const draftsBadge =
    left !== null &&
    (left > 0 ? (
      <span className="font-code-label text-code-label text-on-surface-variant/70">
        {left} of {TRIAL_DRAFTS} drafts left
      </span>
    ) : (
      <button
        type="button"
        onClick={() => setShowUpgrade(true)}
        className="font-code-label text-code-label text-error underline-offset-2 transition-colors hover:underline"
      >
        No drafts left · Upgrade
      </button>
    ))

  const activeTitle = commands.find((c) => c.command === activeCommand)?.title
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

      <div className="flex items-end gap-2 rounded-2xl border border-border-muted bg-surface-container-low p-3">
        <div className="flex flex-1 flex-col gap-1.5">
          {activeCommand && (
            <span className="flex w-fit items-center gap-1 rounded-full bg-electric-indigo/15 px-2.5 py-1 font-code-label text-code-label text-electric-indigo">
              /{activeCommand}{activeTitle ? ` · ${activeTitle}` : ''}
              <button type="button" onClick={() => setActiveCommand('')} aria-label="Clear format" className="hover:text-on-surface">
                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          )}
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label="Message"
            placeholder={started ? 'reply, or ask to tighten / change the hook…' : 'what do you want to post about?  (type / for formats)'}
            className="max-h-[50vh] w-full resize-none overflow-y-auto rounded-xl bg-transparent p-2 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-electric-indigo text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-50"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_upward</span>
        </button>
      </div>
    </div>
  )

  const controlsRow = (modePicker || voicePicker || draftsBadge) && (
    <div className="mb-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      {draftsBadge}
      {modePicker}
      {voicePicker}
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
          {controlsRow}
          {composer}
          {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
        </div>
        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      </div>
    )
  }

  let draftN = 0
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col">
      <div className="flex flex-1 flex-col gap-4 pb-4">
        {turns.map((t) => {
          if ('draft' in t) {
            return <DraftCard key={t.id} draft={t.draft} index={draftN++} />
          }
          if (t.role === 'user') {
            return (
              <div key={t.id} className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-electric-indigo/15 px-4 py-2.5">
                <p className="whitespace-pre-wrap font-body-md text-on-surface">{t.text}</p>
              </div>
            )
          }
          return (
            <div key={t.id} className="self-start max-w-[85%] rounded-2xl rounded-bl-md bg-surface-container-low px-4 py-2.5">
              <p className="whitespace-pre-wrap font-body-md text-on-surface">{t.text}</p>
            </div>
          )
        })}
        {loading && (
          <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-surface-container-low px-4 py-2.5 font-code-label text-code-label text-on-surface-variant">
            <Spinner size={16} className="text-electric-indigo" />
            writing in your voice…
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-1 bg-surface/80 px-1 pb-2 pt-1 backdrop-blur-sm">
        {controlsRow}
        {composer}
        {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
      </div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
