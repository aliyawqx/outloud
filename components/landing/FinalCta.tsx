import Link from 'next/link'
import { Blob, Sparkle, Underline } from './Doodles'

export function FinalCta() {
  return (
    <section className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="grid grid-cols-1 items-center gap-12 overflow-hidden rounded-[2rem] border border-border-muted bg-surface-container-low p-8 md:grid-cols-2 md:p-14">
        {/* left: copy */}
        <div className="reveal">
          <h2 className="font-headline-xl text-headline-xl leading-tight">
            Start sounding like{' '}
            <span className="relative inline-block text-cyber-lime">
              you
              <Underline className="absolute -bottom-2 left-0 h-3 w-full text-electric-indigo" />
            </span>
            .
          </h2>
          <p className="mt-5 max-w-md font-body-md text-body-md text-on-surface-variant">
            Three days free. Capture your voice, turn your next ship into a post, and never sound like generic AI again.
          </p>
          <Link
            href="/signup"
            className="indigo-glow mt-8 inline-flex rounded-full bg-electric-indigo px-9 py-4 text-lg font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
          >
            Get Started
          </Link>
        </div>

        {/* right: before/after on an organic blob */}
        <div className="relative">
          <Blob className="absolute inset-0 -z-10 mx-auto h-full w-full scale-125 text-electric-indigo/15" />
          <Sparkle className="absolute -right-1 top-2 text-cyber-lime" size={20} />
          <div className="reveal float-y mx-auto flex max-w-sm flex-col gap-3" style={{ transitionDelay: '120ms' }}>
            <div className="rounded-2xl border border-border-muted bg-surface-container-high/60 p-4 opacity-70">
              <p className="mb-1 font-code-label text-[11px] uppercase tracking-wide text-on-surface-variant/60">Generic AI</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">🚀 Excited to share that we just shipped dark mode! This is a game-changer for our users. Stay tuned for more! #buildinpublic</p>
            </div>
            <div className="flex justify-center text-cyber-lime">
              <span className="material-symbols-outlined">arrow_downward</span>
            </div>
            <div className="rounded-2xl border border-electric-indigo/40 bg-surface-container-low p-4 shadow-xl">
              <p className="mb-1 font-code-label text-[11px] uppercase tracking-wide text-electric-indigo">Your voice</p>
              <p className="font-body-md text-on-surface">dark mode shipped. exports 2x faster now. one missing await cost me the whole afternoon. classic.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
