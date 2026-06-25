import Link from 'next/link'
import { HighlightsCarousel } from './HighlightsCarousel'
import { Sparkle } from './Doodles'

export function Highlights() {
  return (
    <section className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="reveal mx-auto mb-12 max-w-2xl text-center">
        <h2 className="mb-3 font-headline-lg text-headline-lg">Grow with replies, ship with posts.</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Find posts worth replying to, and turn what you ship into posts. All in your own voice.
        </p>
      </div>

      <HighlightsCarousel />

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
