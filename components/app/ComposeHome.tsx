'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ChatTurnRecord, DraftPost } from '@/lib/voice/types'

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
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">send</span>
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

export function ComposeHome({ name, voices, initialSession }: { name: string; voices: VoiceOption[]; initialSession?: ComposeSession }) {
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
    const text = input.trim()
    if (!text || loading) return
    setError('')
    const userTurn: Turn = { id: id(), role: 'user', text }
    const turnsPayload = toRecords(userTurn)
    setTurns((t) => [...t, userTurn])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: turnsPayload, profileId: voiceId || undefined, historyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.needsVoice) {
        router.push('/app/onboarding')
        return
      }
      if (!res.ok) {
        setError(data.error ?? "Couldn't write that. Try again.")
        return
      }
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
      send()
    }
  }

  const voicePicker = voices.length > 1 && (
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

  const composer = (
    <div className="flex items-end gap-2 rounded-2xl border border-border-muted bg-surface-container-low p-3">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Message"
        placeholder={started ? 'reply, or ask to tighten / change the hook…' : 'what do you want to post about?'}
        className="h-12 max-h-40 min-h-12 flex-1 resize-none rounded-xl bg-transparent p-2 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
      />
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
  )

  if (!started) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center">
        <h1 className="text-center font-headline-xl text-headline-xl">
          what do you want to post about, <span className="text-electric-indigo">{name}</span>?
        </h1>
        <p className="mt-2 text-center font-body-md text-body-md text-on-surface-variant">
          Type a rough idea. I’ll ask anything I need, then write it in your voice.
        </p>
        <div className="mt-6 w-full">{composer}</div>
        {voicePicker && <div className="mt-3">{voicePicker}</div>}
        {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
      </div>
    )
  }

  let draftN = 0
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col">
      {voicePicker && <div className="mb-4 flex justify-end">{voicePicker}</div>}

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
          <div className="self-start font-code-label text-code-label text-on-surface-variant/60">thinking…</div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-1 bg-surface/80 px-1 pb-2 pt-1 backdrop-blur-sm">
        {composer}
        {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
      </div>
    </div>
  )
}
