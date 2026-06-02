'use client'

import { useEffect, useState } from 'react'
import { STYLE_PRESETS } from '@/lib/styles'

const VOICE_KEY = 'outloud.voiceSamples'
type Intensity = 'safe' | 'bold' | 'spicy' | 'funny'

const chip = (active: boolean) =>
  `px-5 py-2 rounded-full border font-medium transition-all ${
    active
      ? 'border-cyber-lime text-cyber-lime bg-cyber-lime/5'
      : 'border-border-muted text-on-surface-variant hover:border-on-surface'
  }`

const field =
  'w-full bg-surface-container-lowest border border-border-muted rounded-lg p-4 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none focus:ring-0 transition-all'

function splitSamples(raw: string): string[] {
  return raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
}

export function ReplyComposer() {
  const [style, setStyle] = useState('yourself')
  const [voiceRaw, setVoiceRaw] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [angle, setAngle] = useState('')
  const [intensity, setIntensity] = useState<Intensity>('bold')
  const [subtleHumor, setSubtleHumor] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(VOICE_KEY)
    if (saved) setVoiceRaw(saved)
  }, [])
  useEffect(() => {
    localStorage.setItem(VOICE_KEY, voiceRaw)
  }, [voiceRaw])

  const isYou = style === 'yourself'
  const samples = splitSamples(voiceRaw)

  async function onGenerate() {
    setError('')
    setReply('')
    setCopied(false)
    if (!replyTo.trim()) {
      setError('Paste the post you want to reply to.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyTo,
          angle,
          hookIntensity: intensity,
          subtleHumor,
          ...(isYou ? { samples } : { styleId: style }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate a reply. Try again.")
        return
      }
      setReply(data.draft.fullText)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const activeName = isYou ? 'YOU' : STYLE_PRESETS.find((p) => p.id === style)?.name.toUpperCase()

  return (
    <>
      {/* Voice selector */}
      <section className="mb-12">
        <div className="mb-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-electric-indigo">settings_voice</span>
          <h2 className="font-code-label text-code-label uppercase tracking-widest text-on-surface-variant">Select AI Voice Identity</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className={chip(isYou)} onClick={() => setStyle('yourself')}>Yourself</button>
          {STYLE_PRESETS.map((p) => (
            <button key={p.id} className={chip(style === p.id)} onClick={() => setStyle(p.id)}>{p.name}</button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        {/* Input */}
        <div className="flex flex-col gap-6">
          {isYou && (
            <div className="glass-panel flex flex-col gap-3 rounded-xl p-6">
              <h3 className="font-code-label text-code-label uppercase text-on-surface-variant">Your voice — paste 5+ posts (blank line between, optional)</h3>
              <textarea value={voiceRaw} onChange={(e) => setVoiceRaw(e.target.value)} className={`${field} h-32 resize-none`} placeholder={'lost a customer to a 2am bug. lesson: stop shipping at 2am'} />
            </div>
          )}

          <div className="glass-panel flex flex-col gap-4 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-code-label text-code-label uppercase text-electric-indigo">Target Content</h3>
              <span className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                <span className="ai-pulse h-2 w-2 rounded-full bg-electric-indigo" /> AI Ready
              </span>
            </div>
            <textarea value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className={`${field} h-48 resize-none`} placeholder="Paste the post you want to reply to here..." />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input value={angle} onChange={(e) => setAngle(e.target.value)} className={field} placeholder="your angle (optional)" />
              <select value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)} className={field}>
                <option value="safe">hook: safe</option>
                <option value="bold">hook: bold</option>
                <option value="spicy">hook: spicy</option>
                <option value="funny">hook: funny</option>
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-3 font-body-sm text-body-sm text-on-surface">
              <input type="checkbox" checked={subtleHumor} onChange={(e) => setSubtleHumor(e.target.checked)} />
              тонкий юмор — double meaning
            </label>

            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

            <button onClick={onGenerate} disabled={loading} className="w-full rounded-lg bg-electric-indigo py-4 font-bold text-white shadow-lg shadow-electric-indigo/20 transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60">
              {loading ? 'Generating…' : 'Generate Reply'}
            </button>
          </div>
        </div>

        {/* Draft */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-code-label text-code-label uppercase text-on-surface-variant">AI Generated Draft</h3>
          </div>

          {reply ? (
            <div className="glass-panel neon-glow group rounded-xl p-6 transition-all">
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded border border-cyber-lime/20 bg-cyber-lime/10 px-2 py-1 font-code-label text-[10px] text-cyber-lime">{activeName}</span>
              </div>
              <p className="mb-6 whitespace-pre-wrap font-body-md leading-relaxed text-on-surface">{reply}</p>
              <div className="flex items-center justify-between border-t border-border-muted pt-4">
                <button onClick={copy} className="flex items-center gap-1 font-code-label text-xs text-on-surface-variant transition-colors hover:text-white">
                  <span className="material-symbols-outlined text-sm">content_copy</span> {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={onGenerate} className="flex items-center gap-1 font-code-label text-xs text-on-surface-variant transition-colors hover:text-white">
                  <span className="material-symbols-outlined text-sm">refresh</span> Regenerate
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border-muted font-code-label text-code-label text-on-surface-variant/50">
              {loading ? 'thinking…' : 'your reply appears here'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
