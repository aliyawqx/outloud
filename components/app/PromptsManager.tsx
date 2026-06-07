'use client'

import { useState } from 'react'
import { createPrompt, deletePrompt, updatePrompt, type Prompt } from '@/lib/prompts/client'

const field =
  'w-full rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-2 font-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none'

function PromptCard({ prompt, onChange, onRemove }: { prompt: Prompt; onChange: (p: Prompt) => void; onRemove: () => void }) {
  const [command, setCommand] = useState(prompt.command)
  const [title, setTitle] = useState(prompt.title)
  const [text, setText] = useState(prompt.text)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const dirty = command !== prompt.command || title !== prompt.title || text !== prompt.text

  async function save() {
    setError('')
    setSaving(true)
    try {
      const { prompt: up } = await updatePrompt(prompt.id, { command, title, text })
      onChange(up)
      setCommand(up.command)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete /${prompt.command}?`)) return
    try {
      await deletePrompt(prompt.id)
      onRemove()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-muted bg-surface-container-low p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-code-label text-code-label text-on-surface-variant">/</span>
        <input value={command} onChange={(e) => setCommand(e.target.value)} aria-label="Command" className={`${field} max-w-[180px]`} placeholder="command" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" className={`${field} flex-1`} placeholder="Title" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Prompt text"
        className={`${field} h-40 resize-y leading-relaxed`}
        placeholder="Describe the STRUCTURE of this output type. The voice handles tone."
      />
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-full bg-electric-indigo px-5 py-2 font-code-label text-code-label text-white transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="font-code-label text-code-label text-cyber-lime">Saved.</span>}
        <button
          type="button"
          onClick={remove}
          className="ml-auto flex items-center gap-1 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-error"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete</span> Delete
        </button>
      </div>
    </div>
  )
}

export function PromptsManager({ initial }: { initial: Prompt[] }) {
  const [prompts, setPrompts] = useState(initial)
  const [open, setOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    setError('')
    setBusy(true)
    try {
      const { prompt } = await createPrompt({ command, title, text })
      setPrompts((p) => [...p, prompt])
      setCommand(''); setTitle(''); setText(''); setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that command.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Slash commands you can use in the composer. Type <span className="text-on-surface">/</span> there to pick one.
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-4 py-2 font-code-label text-code-label text-cyber-lime transition-all hover:bg-cyber-lime/20"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span> New command
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 rounded-2xl border border-cyber-lime/30 bg-cyber-lime/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-code-label text-code-label text-on-surface-variant">/</span>
            <input value={command} onChange={(e) => setCommand(e.target.value)} aria-label="New command" className={`${field} max-w-[180px]`} placeholder="cold-email" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New title" className={`${field} flex-1`} placeholder="Cold email" />
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="New prompt text" className={`${field} h-32 resize-y`} placeholder="Describe the STRUCTURE of this output type…" />
          {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={add}
              disabled={busy || !command.trim() || !title.trim() || !text.trim()}
              className="rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
            >
              {busy ? 'Adding…' : 'Add command'}
            </button>
          </div>
        </div>
      )}

      {prompts.map((p) => (
        <PromptCard
          key={p.id}
          prompt={p}
          onChange={(up) => setPrompts((list) => list.map((x) => (x.id === up.id ? up : x)))}
          onRemove={() => setPrompts((list) => list.filter((x) => x.id !== p.id))}
        />
      ))}
    </div>
  )
}
