import Link from 'next/link'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'
import { LampGlow } from '@/components/ui/lamp'
import { AppShot } from './AppShot'
import { RotatingWord } from './motion'

const WORDS = ['posts in your voice.', 'replies that grow you.', 'build-in-public gold.', 'never generic AI.']

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-charcoal-black">
      {/* static lamp light, sitting above the headline */}
      <LampGlow className="top-[0.5rem] h-[32rem]" />

      <div className="relative z-10">
        {/* mascot, peeking from the bottom-left of the 3D card */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot.svg"
          alt=""
          className="float-y pointer-events-none absolute bottom-[0.5rem] left-[10%] z-30 hidden h-40 w-40 drop-shadow-[0_12px_34px_rgba(155,108,248,0.5)] lg:block xl:left-[14%] xl:h-48 xl:w-48"
        />
        <ContainerScroll
          titleComponent={
            <div className="flex flex-col items-center gap-5 pt-20 pb-24 md:pt-28 md:pb-32">
              <div className="inline-flex items-center gap-2 rounded-full border border-border-muted bg-surface-container-low px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric-indigo opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-electric-indigo" />
                </span>
                <span className="font-code-label text-code-label uppercase tracking-widest text-on-surface-variant">Early access</span>
              </div>

              <h1 className="max-w-3xl font-headline-xl text-headline-xl leading-tight">
                Turn what you ship into
                <span className="mt-1 block">
                  <RotatingWord words={WORDS} className="bg-gradient-to-r from-electric-indigo to-secondary bg-clip-text text-transparent" />
                </span>
              </h1>

              <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">
                Stop the generic AI slop. Outloud captures how you actually write and turns your commits and build logs into high-signal posts and replies.
              </p>

              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <Link
                  href="/signup"
                  className="indigo-glow rounded-full bg-electric-indigo px-8 py-4 text-center text-lg font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  Join Early Access
                </Link>
                <a
                  href="#examples"
                  className="group flex items-center justify-center gap-2 rounded-full border border-border-muted px-7 py-4 text-lg font-bold text-on-surface transition-all hover:-translate-y-0.5 hover:border-electric-indigo"
                >
                  <span className="material-symbols-outlined text-[20px] text-electric-indigo transition-transform group-hover:scale-110">play_circle</span>
                  See it work
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
