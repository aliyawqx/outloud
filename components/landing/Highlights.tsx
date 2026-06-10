import Link from 'next/link'
import { ComposerMockup } from './ComposerMockup'
import { Sparkle } from './Doodles'

export function Highlights() {
  return (
    <section className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="reveal mx-auto mb-12 max-w-2xl text-center">
        <h2 className="mb-3 font-headline-lg text-headline-lg">From a rough line to a post that sounds like you.</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Outloud learns your voice from your own writing, then drafts in it. No blank page, no generic AI tone.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* card 1: voice capture */}
        <div className="reveal glass-card group rounded-3xl p-6 transition-all hover:-translate-y-1 hover:border-secondary/40">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/20">
              <span className="material-symbols-outlined text-secondary">graphic_eq</span>
            </span>
            <h3 className="font-headline-sm text-headline-sm">Voice capture</h3>
          </div>
          <div className="rounded-2xl border border-border-muted bg-surface-container-low p-4">
            <p className="mb-3 font-code-label text-code-label text-on-surface-variant">your past posts →</p>
            <div className="mb-4 flex h-16 items-center justify-center gap-1.5">
              {[10, 22, 34, 18, 28, 40, 24, 14, 30, 20, 36, 12].map((h, i) => (
                <span key={i} className="w-1.5 rounded-full bg-secondary/80" style={{ height: h }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {['lowercase', 'dry humor', 'short lines', 'numbers-honest'].map((t) => (
                <span key={t} className="rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-1 font-code-label text-[11px] text-secondary">{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* card 2: idea -> post */}
        <div className="reveal glass-card group rounded-3xl p-6 transition-all hover:-translate-y-1 hover:border-electric-indigo/40" style={{ transitionDelay: '100ms' }}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-electric-indigo/20">
              <span className="material-symbols-outlined text-electric-indigo">edit_square</span>
            </span>
            <h3 className="font-headline-sm text-headline-sm">Idea → finished post</h3>
          </div>
          <ComposerMockup compact />
        </div>
      </div>

      {/* full-width accent banner */}
      <div className="reveal relative mt-6 flex flex-col items-start justify-between gap-6 overflow-hidden rounded-3xl bg-electric-indigo p-8 sm:flex-row sm:items-center md:p-10">
        <Sparkle className="absolute right-32 top-4 text-white/40" size={18} />
        <div className="relative z-10">
          <h3 className="mb-1 font-headline-lg text-headline-lg text-white">Your voice, on tap.</h3>
          <p className="font-body-md text-body-md text-white/80">Write a week of posts in the time it takes to write one.</p>
        </div>
        <div className="relative z-10 flex items-center gap-6">
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-full bg-white px-7 py-3 font-bold text-electric-indigo transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            Start free
          </Link>
          <span className="hidden h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 sm:grid">
            <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white">
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
