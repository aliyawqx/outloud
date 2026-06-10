import Link from 'next/link'
import { ComposerMockup } from './ComposerMockup'
import { CountUp, CyclingHeadline, Parallax } from './motion'
import { CurvedArrow, Sparkle } from './Doodles'

const PHRASES = ['posts in your own voice.', 'build-in-public gold.', 'scroll-stopping hooks.']

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* ambient accent glow that drifts */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[34rem] w-[60rem] max-w-none -translate-x-1/2 animate-[drift_12s_ease-in-out_infinite] rounded-full bg-electric-indigo/10 blur-[140px]" />

      <div className="mx-auto grid max-w-container-max items-center gap-12 px-margin-mobile py-16 md:grid-cols-2 md:gap-10 md:px-margin-desktop md:py-24">
        {/* ── left: copy ── */}
        <div className="relative">
          <div className="reveal mb-6 inline-flex items-center gap-2 rounded-full border border-border-muted bg-surface-container-low px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric-indigo opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-electric-indigo" />
            </span>
            <span className="font-code-label text-code-label uppercase tracking-widest text-on-surface-variant">Early access</span>
          </div>

          <h1 className="reveal font-headline-xl text-headline-xl leading-tight" style={{ transitionDelay: '80ms' }}>
            Turn what you ship into
            <br />
            <CyclingHeadline
              phrases={PHRASES}
              className="bg-gradient-to-r from-electric-indigo to-secondary bg-clip-text text-transparent"
            />
          </h1>

          <p className="reveal mt-6 max-w-md font-body-md text-body-md text-on-surface-variant" style={{ transitionDelay: '160ms' }}>
            Stop the generic AI slop. Outloud captures how you actually write and turns your commits and build logs into high-signal posts.
          </p>

          <div className="reveal relative mt-8 flex flex-col gap-4 sm:flex-row sm:items-center" style={{ transitionDelay: '240ms' }}>
            <Link
              href="/signup"
              className="indigo-glow rounded-full bg-electric-indigo px-8 py-4 text-center text-lg font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
            >
              Join Early Access
            </Link>
            <a
              href="#features"
              className="group flex items-center justify-center gap-2 rounded-full border border-border-muted px-7 py-4 text-lg font-bold text-on-surface transition-all hover:-translate-y-0.5 hover:border-electric-indigo"
            >
              <span className="material-symbols-outlined text-[20px] text-electric-indigo transition-transform group-hover:scale-110">play_circle</span>
              See Features
            </a>
            {/* arrow doodle pointing at the primary CTA */}
            <CurvedArrow className="pointer-events-none absolute -right-2 -top-24 hidden text-cyber-lime/70 lg:block" />
          </div>

          {/* proof card — the founder's real reply-driven reach (count-up) */}
          <div className="reveal mt-10 flex max-w-sm items-center gap-4 rounded-3xl border border-border-muted bg-surface-container-low p-5" style={{ transitionDelay: '320ms' }}>
            <div className="leading-none">
              <CountUp to={22} suffix="k" className="font-headline-xl text-headline-xl text-cyber-lime" />
              <span className="ml-1 font-body-md text-body-md text-on-surface-variant">views</span>
            </div>
            <div className="h-10 w-px bg-border-muted" />
            <div className="flex-1">
              <div className="mb-2 flex -space-x-2">
                {['bg-electric-indigo/40', 'bg-cyber-lime/40', 'bg-primary-container/50', 'bg-secondary/40'].map((c, i) => (
                  <span key={i} className={`h-7 w-7 rounded-full ring-2 ring-surface-container-low ${c}`} />
                ))}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">the founder’s own reach — mostly from replies in his voice.</p>
            </div>
          </div>
        </div>

        {/* ── right: product mockup ── */}
        <div className="reveal relative" style={{ transitionDelay: '200ms' }}>
          <Sparkle className="absolute -left-3 -top-5 z-10 text-cyber-lime" size={26} />
          <Sparkle className="absolute right-6 -top-8 z-10 text-electric-indigo" size={18} />
          <Sparkle className="absolute -bottom-4 -left-6 z-10 text-electric-indigo" size={20} />
          <Parallax speed={0.06}>
            <div className="float-y">
              <ComposerMockup />
            </div>
          </Parallax>
        </div>
      </div>
    </section>
  )
}
