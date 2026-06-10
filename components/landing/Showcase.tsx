import { CurvedArrow, Squiggle } from './Doodles'

// Same idea, written in three different captured voices — the "your voice, not
// generic AI" pitch made concrete. Round-image card layout.
const VOICES = [
  {
    initial: 'W',
    ring: 'ring-electric-indigo/40 bg-electric-indigo/20 text-electric-indigo',
    name: 'Your voice',
    caption: '“dark mode shipped. exports 2x faster now. one missing await cost me the whole afternoon. classic.”',
  },
  {
    initial: 'F',
    ring: 'ring-cyber-lime/40 bg-cyber-lime/20 text-cyber-lime',
    name: 'Punchy founder',
    caption: '“2x faster exports. dark mode. shipped today. speed is a feature — most teams forget that.”',
  },
  {
    initial: 'B',
    ring: 'ring-primary-container/50 bg-primary-container/20 text-primary-container',
    name: 'Build-in-public',
    caption: '“day 12: shipped dark mode + doubled export speed. small wins compound. onto the next one.”',
  },
]

export function Showcase() {
  return (
    <section id="examples" className="relative overflow-hidden py-20">
      {/* soft accent wash for this section */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-electric-indigo/[0.06] via-transparent to-cyber-lime/[0.05]" />

      <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
        <div className="reveal relative mx-auto mb-14 max-w-2xl text-center">
          <h2 className="mb-3 font-headline-lg text-headline-lg">One idea, written like you — not like ChatGPT.</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">The same update, in a few captured voices. Pick yours.</p>
          <CurvedArrow className="absolute -right-4 -top-10 hidden -scale-x-100 text-cyber-lime/60 lg:block" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {VOICES.map((v, i) => (
            <div
              key={v.name}
              className="reveal group relative rounded-3xl border border-border-muted bg-surface-container-low p-7 text-center transition-all hover:-translate-y-1 hover:border-white/15"
              style={{ transitionDelay: `${i * 110}ms` }}
            >
              {i === 1 && <Squiggle className="absolute -right-2 top-6 text-electric-indigo/50" />}
              <span className={`mx-auto mb-4 grid h-20 w-20 place-items-center overflow-hidden rounded-full ring-4 ${v.ring}`}>
                <span className="font-headline-lg text-headline-lg transition-transform duration-300 group-hover:scale-110">{v.initial}</span>
              </span>
              <p className="mb-3 font-headline-sm text-headline-sm">{v.name}</p>
              <p className="font-body-sm text-body-sm italic text-on-surface-variant">{v.caption}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
