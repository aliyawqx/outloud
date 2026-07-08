'use client'

import { useState, type ReactNode } from 'react'
import { AppShot } from './AppShot'
import { ComposerMockup } from './ComposerMockup'
import { ReplyFinderMockup } from './ReplyFinderMockup'

// A coded full-app screenshot slide, framed like a product window.
function AppShotSlide() {
  return (
    <div className="glass-card overflow-hidden rounded-3xl border-white/10 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border-muted px-5 py-3">
        <span className="h-3 w-3 rounded-full bg-error/40" />
        <span className="h-3 w-3 rounded-full bg-secondary/40" />
        <span className="h-3 w-3 rounded-full bg-electric-indigo/40" />
        <span className="ml-3 font-code-label text-code-label text-on-surface-variant">outloud · app</span>
      </div>
      {/* Render the app UI larger, then scale it down so the WHOLE screen fits
          (zoomed out) instead of a cropped close-up. */}
      <div className="relative aspect-video overflow-hidden bg-surface">
        <div className="absolute left-0 top-0 h-[143%] w-[143%] origin-top-left scale-[0.7]">
          <AppShot />
        </div>
      </div>
    </div>
  )
}

type Slide = { key: string; icon: string; color: string; ring: string; title: string; node: ReactNode }

const SLIDES: Slide[] = [
  { key: 'demo', icon: 'dashboard', color: 'text-electric-indigo', ring: 'bg-electric-indigo/20', title: 'Inside Outloud', node: <AppShotSlide /> },
  { key: 'reply', icon: 'travel_explore', color: 'text-cyber-lime', ring: 'bg-cyber-lime/20', title: 'Reply finder', node: <ReplyFinderMockup /> },
  { key: 'post', icon: 'edit_square', color: 'text-electric-indigo', ring: 'bg-electric-indigo/20', title: 'Idea → finished post', node: <ComposerMockup compact /> },
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
      {/* stage - top-aligned cards so the card chrome is always visible */}
      <div className="relative mx-auto h-[480px] max-w-4xl overflow-hidden sm:h-[540px]">
        {/* soft glow lifting the active card off the dark page so its text reads clearly */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[65%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric-indigo/15 blur-[90px]" />
        {SLIDES.map((s, i) => {
          const raw = (i - index + n) % n
          const pos = raw === 0 ? 0 : raw === n - 1 ? -1 : raw // n=3 → {0, 1, -1}
          if (Math.abs(pos) > 1) return null
          const active = pos === 0
          return (
            <div
              key={s.key}
              aria-hidden={!active}
              className="absolute left-1/2 top-0 w-[86%] sm:w-[70%]"
              style={{
                // Side slides are pushed back (smaller, blurred, faded) rather than
                // darkened - keeps them as quiet context without making the area murky.
                transform: `translateX(calc(-50% + ${pos * 86}%)) scale(${active ? 1 : 0.88})`,
                transformOrigin: 'top center',
                opacity: active ? 1 : 0.35,
                filter: active ? 'none' : 'blur(1px)',
                zIndex: active ? 20 : 10,
                pointerEvents: active ? 'auto' : 'none',
                transition: 'transform .5s cubic-bezier(.22,1,.36,1), opacity .5s, filter .5s',
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.ring}`}>
                  <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                </span>
                <h3 className="font-headline-sm text-headline-sm">{s.title}</h3>
              </div>
              {s.node}
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
