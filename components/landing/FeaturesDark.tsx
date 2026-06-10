import { Sparkle, Underline } from './Doodles'

const FEATURES = [
  {
    icon: 'format_quote',
    color: 'text-electric-indigo',
    ring: 'border-electric-indigo/40 bg-electric-indigo/10',
    title: 'Posts in your captured voice',
    accent: 'voice',
    desc: 'Turn what you ship into posts that sound like you wrote them — your cadence, your edge, never a generic AI tone.',
  },
  {
    icon: 'travel_explore',
    color: 'text-cyber-lime',
    ring: 'border-cyber-lime/40 bg-cyber-lime/10',
    title: 'Replies that grow you',
    accent: 'grow',
    desc: 'Outloud finds posts in your niche, drafts a reply in your voice, and you post it in a click. The engine behind those 22k views.',
    elevated: true,
  },
  {
    icon: 'graphic_eq',
    color: 'text-electric-indigo',
    ring: 'border-electric-indigo/40 bg-electric-indigo/10',
    title: 'A voice built from your real writing',
    accent: 'real',
    desc: 'Paste a few of your posts and Outloud learns how you actually sound, then keeps every draft on-voice.',
  },
]

function Title({ text, accent, color }: { text: string; accent: string; color: string }) {
  const [before, after] = text.split(accent)
  return (
    <h3 className="font-headline-sm text-headline-sm">
      {before}
      <span className={`relative inline-block ${color}`}>
        {accent}
        <Underline className="absolute -bottom-1.5 left-0 h-2 w-full opacity-70" />
      </span>
      {after}
    </h3>
  )
}

export function FeaturesDark() {
  return (
    <section id="features" className="mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop">
      <div className="reveal relative overflow-hidden rounded-[2rem] bg-charcoal-black px-6 py-14 md:px-12 md:py-20">
        <Sparkle className="absolute right-10 top-10 text-cyber-lime" size={24} />
        <Sparkle className="absolute right-24 top-20 text-electric-indigo" size={16} />

        <div className="mb-14 max-w-xl">
          <div className="mb-3 font-code-label text-code-label text-cyber-lime">// WHAT YOU GET</div>
          <h2 className="font-headline-lg text-headline-lg">
            Everything you need to sound like{' '}
            <span className="relative inline-block text-electric-indigo">
              you
              <Underline className="absolute -bottom-2 left-0 h-3 w-full text-cyber-lime" />
            </span>
            .
          </h2>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`reveal rounded-3xl p-7 transition-all hover:-translate-y-2 ${
                f.elevated
                  ? 'border border-white/10 bg-surface-container-high shadow-2xl md:-translate-y-6 md:hover:-translate-y-8'
                  : 'border border-border-muted bg-white/[0.02] md:mt-4 md:hover:-translate-y-2'
              }`}
              style={{ transitionDelay: `${i * 110}ms` }}
            >
              <span className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full border ${f.ring}`}>
                <span className={`material-symbols-outlined ${f.color}`}>{f.icon}</span>
              </span>
              <Title text={f.title} accent={f.accent} color={f.color} />
              <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
