import Link from 'next/link'
import { HighlightsCarousel } from './HighlightsCarousel'
import { Sparkle } from './Doodles'

export function Highlights() {
  return (
    <section id="features" className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="reveal mx-auto mb-12 max-w-2xl text-center">
        <h2 className="mb-3 font-headline-lg text-headline-lg">Grow with replies, ship with posts.</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Find posts worth replying to, and turn what you ship into posts. All in your own voice.
        </p>
      </div>

      <HighlightsCarousel />

      {/* accent banner — width matched to the carousel so it doesn't dwarf it */}
      <div className="reveal relative mx-auto mt-10 flex max-w-4xl flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl bg-electric-indigo p-6 sm:flex-row sm:items-center md:px-8">
        <Sparkle className="absolute right-24 top-3 text-white/40" size={16} />
        <div className="relative z-10">
          <h3 className="mb-1 font-headline-sm text-xl font-bold text-white">Sound like you, on tap.</h3>
          <p className="font-body-sm text-body-sm text-white/80">Write a week of posts in the time it takes to write one.</p>
        </div>
        <Link
          href="/signup"
          className="relative z-10 whitespace-nowrap rounded-full bg-white px-6 py-2.5 font-bold text-electric-indigo transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          Start free
        </Link>
      </div>
    </section>
  )
}
