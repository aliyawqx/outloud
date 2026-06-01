'use client'

import { useEffect, useRef, useState } from 'react'
import { useCountUp } from './hooks'
import { Tweet, Stat, MatchBadge } from './ui'

const DRAFTS = [
  {
    text: "spent the weekend making the app 40% faster.\n\nnobody asked for it. it just bugged me every time i opened the dashboard.\n\nthat's the whole reason. shipped dark mode too while i was in there.",
    match: 97,
  },
  {
    text: "load times were 40% slower than they had any right to be and i couldn't let it go.\n\nfixed it this weekend. threw in dark mode as a treat.\n\nsmall stuff. but this is the part of building i actually like.",
    match: 94,
  },
]
const STEPS = ['reading your last 40 posts', 'matching cadence + word choice', 'drafting in your voice']

type Phase = 'idle' | 'gen' | 'review' | 'posted'

export function GenerationDemo() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [stepI, setStepI] = useState(0)
  const [typed, setTyped] = useState(['', ''])
  const [picked, setPicked] = useState(0)
  const [input, setInput] = useState(
    'shipped dark mode + cut load time 40%. nobody asked but it bugged me every time i opened the app.',
  )
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => () => clearTimers(), [])

  const reset = () => {
    clearTimers()
    setPhase('idle')
    setStepI(0)
    setTyped(['', ''])
    setPicked(0)
  }

  const generate = () => {
    clearTimers()
    setPhase('gen')
    setStepI(0)
    setTyped(['', ''])
    STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setStepI(i), i * 620)))
    const startType = STEPS.length * 620 + 250
    timers.current.push(
      setTimeout(() => {
        setPhase('review')
        DRAFTS.forEach((d, di) => {
          d.text.split('').forEach((_, ci) => {
            timers.current.push(
              setTimeout(
                () => {
                  setTyped((prev) => {
                    const n = [...prev]
                    n[di] = d.text.slice(0, ci + 1)
                    return n
                  })
                },
                di * 120 + ci * 9,
              ),
            )
          })
        })
      }, startType),
    )
  }

  const post = () => {
    clearTimers()
    setPhase('posted')
  }

  const imp = useCountUp(4231, phase === 'posted')
  const likes = useCountUp(318, phase === 'posted')
  const follows = useCountUp(27, phase === 'posted')

  return (
    <div className="win" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="win__bar">
        <span className="win__lights">
          <i />
          <i />
          <i />
        </span>
        <span className="win__title">outloud / compose</span>
        <span style={{ marginLeft: 'auto' }} className="row center gap-8">
          <span className="dot dot--live" />
          <span className="win__title">voice synced</span>
        </span>
      </div>

      <div style={{ padding: 22 }}>
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: 'var(--faint)',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          what did you ship?
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          spellCheck={false}
          style={{
            width: '100%',
            resize: 'none',
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
            fontSize: 15.5,
            lineHeight: 1.5,
            outline: 'none',
          }}
        />

        <div className="row center between" style={{ marginTop: 14, flexWrap: 'wrap', gap: 12 }}>
          <div className="row center gap-8">
            <span className="tag">
              <span style={{ color: 'var(--accent)' }}>changelog</span>
            </span>
            <span className="tag mono">+ idea</span>
          </div>
          {phase === 'idle' && (
            <button className="btn btn--primary" onClick={generate}>
              generate in my voice <span aria-hidden>→</span>
            </button>
          )}
          {(phase === 'review' || phase === 'posted') && (
            <button className="btn btn--ghost" onClick={reset}>
              start over
            </button>
          )}
        </div>

        {phase === 'gen' && (
          <div style={{ marginTop: 22 }}>
            {STEPS.map((s, i) => (
              <div
                key={i}
                className="row center gap-12"
                style={{ padding: '9px 0', opacity: i <= stepI ? 1 : 0.3, transition: 'opacity .3s' }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 13, color: i < stepI ? 'var(--accent)' : 'var(--muted)', width: 16 }}
                >
                  {i < stepI ? '✓' : i === stepI ? '▍' : '·'}
                </span>
                <span className="mono" style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}

        {phase === 'review' && (
          <div style={{ marginTop: 22 }}>
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: 'var(--faint)',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              2 drafts · pick one
            </div>
            <div className="grid" style={{ gap: 12 }}>
              {DRAFTS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setPicked(i)}
                  style={{ textAlign: 'left', padding: 0, background: 'none' }}
                >
                  <div
                    className="card"
                    style={{
                      padding: 16,
                      borderColor: picked === i ? 'var(--accent)' : 'var(--border)',
                      boxShadow: picked === i ? '0 0 0 1px var(--accent)' : 'none',
                      transition: 'border-color .2s, box-shadow .2s',
                    }}
                  >
                    <div className="row between center" style={{ marginBottom: 10 }}>
                      <MatchBadge n={d.match} />
                      <span
                        className="mono"
                        style={{ fontSize: 12, color: picked === i ? 'var(--accent)' : 'var(--faint)' }}
                      >
                        {picked === i ? '● selected' : '○ option ' + (i + 1)}
                      </span>
                    </div>
                    <Tweet typed={typed[i]} />
                  </div>
                </button>
              ))}
            </div>
            <button className="btn btn--primary btn--block" style={{ marginTop: 16 }} onClick={post}>
              approve + post <span aria-hidden>↗</span>
            </button>
          </div>
        )}

        {phase === 'posted' && (
          <div style={{ marginTop: 22 }}>
            <div className="row center gap-8" style={{ marginBottom: 14 }}>
              <span className="tag tag--accent">
                <span className="dot" /> posted to X
              </span>
              <span className="win__title">12:04 · just now</span>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <Tweet text={DRAFTS[picked].text} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 14 }}>
              <Stat label="impressions" value={imp.toLocaleString()} />
              <Stat label="likes" value={likes} />
              <Stat label="new followers" value={'+' + follows} accent />
            </div>
            <div
              className="mono"
              style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 14, textAlign: 'center' }}
            >
              feedback loop closed → outloud learns what landed
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
