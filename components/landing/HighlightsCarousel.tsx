'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ComposerMockup } from './ComposerMockup'
import { ReplyFinderMockup } from './ReplyFinderMockup'

// A short demo-video slide. Probes for the real clip and shows it when present;
// otherwise a clean placeholder so the carousel slot is never empty/broken.
function VideoSlide() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/demo/voice-capture.mp4', { method: 'HEAD' })
      .then((r) => { if (alive && r.ok) setReady(true) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return (
    <div className="glass-card overflow-hidden rounded-3xl border-white/10 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border-muted px-5 py-3">
        <span className="h-3 w-3 rounded-full bg-error/40" />
        <span className="h-3 w-3 rounded-full bg-secondary/40" />
        <span className="h-3 w-3 rounded-full bg-electric-indigo/40" />
        <span className="ml-3 font-code-label text-code-label text-on-surface-variant">outloud · demo</span>
      </div>
      <div className="relative aspect-video bg-surface-container-lowest">
        {ready ? (
          <video className="h-full w-full object-cover" controls playsInline preload="none" poster="/demo/voice-capture-poster.jpg">
            <source src="/demo/voice-capture.mp4" type="video/mp4" />
          </video>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-on-surface-variant">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-electric-indigo/15 text-electric-indigo">
              <span aria-hidden="true" className="material-symbols-outlined text-[30px]">play_arrow</span>
            </span>
            <span className="font-code-label text-code-label">see it in action</span>
          </div>
        )}
      </div>
    </div>
  )
}

type Slide = { key: string; icon: string; color: string; ring: string; title: string; node: ReactNode }

const SLIDES: Slide[] = [
  { key: 'reply', icon: 'travel_explore', color: 'text-cyber-lime', ring: 'bg-cyber-lime/20', title: 'Reply finder', node: <ReplyFinderMockup /> },
  { key: 'post', icon: 'edit_square', color: 'text-electric-indigo', ring: 'bg-electric-indigo/20', title: 'Idea → finished post', node: <ComposerMockup compact /> },
  { key: 'demo', icon: 'play_circle', color: 'text-electric-indigo', ring: 'bg-electric-indigo/20', title: 'See it in action', node: <VideoSlide /> },
]

// Center-stage carousel: the active slide is bright and centered, the other two peek
// ~1/3 in from each side, dimmed (low contrast), and it loops around. Arrows on both
// sides + dots below.
export function HighlightsCarousel() {
  const [index, setIndex] = useState(0)
  const n = SLIDES.length
  const go = (d: number) => setIndex((i) => (i + d + n) % n)

  const arrow = 'absolute top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-muted bg-surface/85 text-on-surface backdrop-blur transition-colors hover:border-electric-indigo'

  return (
    <div className="reveal relative">
      {/* stage — top-aligned cards so the card chrome is always visible */}
      <div className="relative mx-auto h-[480px] max-w-3xl overflow-hidden sm:h-[540px]">
        {SLIDES.map((s, i) => {
          const raw = (i - index + n) % n
          const pos = raw === 0 ? 0 : raw === n - 1 ? -1 : raw // n=3 → {0, 1, -1}
          if (Math.abs(pos) > 1) return null
          const active = pos === 0
          return (
            <div
              key={s.key}
              aria-hidden={!active}
              className="absolute left-1/2 top-0 w-[82%] sm:w-3/5"
              style={{
                transform: `translateX(calc(-50% + ${pos * 100}%)) scale(${active ? 1 : 0.92})`,
                transformOrigin: 'top center',
                opacity: active ? 1 : 0.4,
                zIndex: active ? 20 : 10,
                pointerEvents: active ? 'auto' : 'none',
                transition: 'transform .5s cubic-bezier(.22,1,.36,1), opacity .5s',
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.ring}`}>
                  <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                </span>
                <h3 className="font-headline-sm text-headline-sm">{s.title}</h3>
              </div>
              <div className="relative">
                {s.node}
                {/* dim veil on the side slides so the center reads as the focus */}
                {!active && <div className="absolute inset-0 rounded-3xl bg-charcoal-black/40" />}
              </div>
            </div>
          )
        })}
      </div>

      <button type="button" aria-label="Previous" onClick={() => go(-1)} className={`${arrow} left-1 sm:-left-2`}>
        <span aria-hidden="true" className="material-symbols-outlined">chevron_left</span>
      </button>
      <button type="button" aria-label="Next" onClick={() => go(1)} className={`${arrow} right-1 sm:-right-2`}>
        <span aria-hidden="true" className="material-symbols-outlined">chevron_right</span>
      </button>

      <div className="mt-6 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Show ${s.title}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={`h-2 cursor-pointer rounded-full transition-all ${i === index ? 'w-6 bg-electric-indigo' : 'w-2 bg-on-surface-variant/30 hover:bg-on-surface-variant/50'}`}
          />
        ))}
      </div>
    </div>
  )
}
