import Link from 'next/link'

// The product in three honest steps: capture once, feed it, post as yourself.
// Mirrors the "3-step funnel" pattern — progressive, scannable, one final CTA.
const STEPS = [
  {
    n: '01',
    icon: 'graphic_eq',
    color: 'text-electric-indigo',
    ring: 'border-electric-indigo/40 bg-electric-indigo/10',
    title: 'Capture your voice',
    desc: 'Paste a few posts or connect X read-only. Outloud learns your cadence, phrasing, and edge — once.',
  },
  {
    n: '02',
    icon: 'bolt',
    color: 'text-cyber-lime',
    ring: 'border-cyber-lime/40 bg-cyber-lime/10',
    title: 'Drop an idea or find a reply',
    desc: 'Give it what you shipped, or let the reply finder surface posts worth answering in your niche.',
  },
  {
    n: '03',
    icon: 'send',
    color: 'text-electric-indigo',
    ring: 'border-electric-indigo/40 bg-electric-indigo/10',
    title: 'Post as yourself',
    desc: 'Get an on-voice draft in seconds. Tweak if you want, then publish to X and Threads in a click.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="reveal mx-auto mb-14 max-w-2xl text-center">
        <div className="mb-3 font-code-label text-code-label text-cyber-lime">// HOW IT WORKS</div>
        <h2 className="mb-3 font-headline-lg text-headline-lg">From zero to on-voice in three steps.</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Set up your voice once. Every post and reply after that sounds like you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className="reveal glass-card group relative rounded-3xl p-7 transition-all hover:-translate-y-1 hover:border-white/15"
            style={{ transitionDelay: `${i * 110}ms` }}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${s.ring}`}>
                <span className={`material-symbols-outlined ${s.color}`} aria-hidden="true">{s.icon}</span>
              </span>
              <span className="font-headline-lg text-headline-lg text-on-surface-variant/15 transition-colors group-hover:text-on-surface-variant/30">
                {s.n}
              </span>
            </div>
            <h3 className="mb-2 font-headline-sm text-headline-sm">{s.title}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="reveal mt-10 text-center">
        <Link
          href="/signup"
          className="indigo-glow inline-flex rounded-full bg-electric-indigo px-8 py-3.5 font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
        >
          Capture your voice free
        </Link>
      </div>
    </section>
  )
}
