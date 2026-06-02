'use client'

import { useState } from 'react'

type Intensity = 'safe' | 'bold' | 'spicy' | 'funny'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '13px 15px',
  color: 'var(--text)',
  fontSize: 15,
  outline: 'none',
  lineHeight: 1.5,
  resize: 'vertical',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 8,
  fontSize: 11.5,
  color: 'var(--faint)',
  textTransform: 'uppercase',
  letterSpacing: '.1em',
  fontFamily: 'var(--font-mono)',
}

export function ReplyComposer() {
  const [replyTo, setReplyTo] = useState('')
  const [angle, setAngle] = useState('')
  const [intensity, setIntensity] = useState<Intensity>('bold')
  const [subtleHumor, setSubtleHumor] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [copied, setCopied] = useState(false)

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
        body: JSON.stringify({ replyTo, angle, hookIntensity: intensity, subtleHumor }),
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

  return (
    <div className="grid" style={{ gap: 28 }}>
      {/* The post to reply to */}
      <div>
        <label style={labelStyle} htmlFor="replyto">
          the post you want to reply to
        </label>
        <textarea
          id="replyto"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          rows={3}
          placeholder="paste the text of a popular post here"
          style={inputStyle}
        />
      </div>

      {/* Options */}
      <div className="grid" style={{ gap: 16, gridTemplateColumns: '1fr 1fr' }} data-stack="true">
        <div>
          <label style={labelStyle} htmlFor="angle">
            your angle (optional)
          </label>
          <input
            id="angle"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="e.g. gently undercut the guru tone"
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="intensity">
            hook intensity
          </label>
          <select
            id="intensity"
            value={intensity}
            onChange={(e) => setIntensity(e.target.value as Intensity)}
            style={{ ...inputStyle, resize: 'none' }}
          >
            <option value="safe">safe</option>
            <option value="bold">bold</option>
            <option value="spicy">spicy</option>
            <option value="funny">funny</option>
          </select>
        </div>
      </div>

      <label className="row center gap-12" style={{ fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
        <input type="checkbox" checked={subtleHumor} onChange={(e) => setSubtleHumor(e.target.checked)} />
        тонкий юмор — double meaning (insiders get a second layer)
      </label>

      {error && <div style={{ color: '#ff6b6b', fontSize: 14 }}>{error}</div>}

      <button className="btn btn--primary btn--block" onClick={onGenerate} disabled={loading}>
        {loading ? 'writing…' : 'generate reply'} <span aria-hidden>→</span>
      </button>

      {reply && (
        <div className="card" style={{ padding: 18, background: 'var(--surface)' }}>
          <div className="row center between" style={{ marginBottom: 12 }}>
            <span className="tag tag--accent">your reply</span>
            <button className="btn btn--ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={copy}>
              {copied ? 'copied ✓' : 'copy'}
            </button>
          </div>
          <div className="tweet__body" style={{ whiteSpace: 'pre-wrap' }}>
            {reply}
          </div>
        </div>
      )}
    </div>
  )
}
