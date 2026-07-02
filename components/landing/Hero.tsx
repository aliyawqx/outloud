import Link from 'next/link'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'
import { LampGlow } from '@/components/ui/lamp'
import { AppShot } from './AppShot'

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-charcoal-black">
      {/* static lamp light, sitting above the headline */}
      <LampGlow className="-top-[4rem] h-[32rem]" />

      <div className="relative z-10">
        <ContainerScroll
          titleComponent={
            // One clear hierarchy: eyebrow → headline (the voice differentiator) →
            // one supporting line → a single primary CTA. Nothing else competes above
            // the fold (mascot/secondary buttons removed to give the hook room).
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-margin-mobile pt-16 pb-24 md:pt-14 md:pb-32">
              <div className="inline-flex items-center gap-2 rounded-full border border-border-muted bg-surface-container-low px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric-indigo opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-electric-indigo" />
                </span>
                <span className="font-code-label text-code-label uppercase tracking-widest text-on-surface-variant">Early access</span>
              </div>

              <h1 className="font-headline-xl text-headline-xl leading-tight">
                POSTS THAT SOUND LIKE YOU.
                <span className="mt-1 block bg-gradient-to-r from-electric-indigo to-secondary bg-clip-text text-transparent">
                  NEVER SMELLABLE AS AI.
                </span>
              </h1>

              <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">
                The moment a post reads as AI, the account gets weaker. Outloud writes in your writing
                voice, the way you actually post, so that never happens.
              </p>

              {/* Single primary CTA. Full-width on mobile so it can never clip at small
                  widths; a quiet text link carries the secondary action. */}
              <div className="flex w-full flex-col items-center gap-3 sm:w-auto">
                <Link
                  href="/signup"
                  className="indigo-glow w-full rounded-full bg-electric-indigo px-8 py-4 text-center text-lg font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 sm:w-auto"
                >
                  Start free, no card needed
                </Link>
                <a
                  href="#how"
                  className="group inline-flex items-center gap-1.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px] text-electric-indigo transition-transform group-hover:scale-110">play_circle</span>
                  See how it works
                </a>
              </div>
            </div>
          }
        >
          <AppShot />
        </ContainerScroll>
      </div>
    </section>
  )
}
