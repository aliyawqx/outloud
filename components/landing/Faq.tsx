import { Underline } from './Doodles'

// Objection-handling block right before the final CTA. Native <details> accordion:
// accessible, keyboard-friendly, zero client JS. Copy stays honest about the
// read-only X scope and the "you stay in control" posting model.
const FAQS = [
  {
    q: 'Does Outloud post for me automatically?',
    a: 'No. Outloud drafts in your voice and you stay in control — review, tweak, then publish to X or Threads with one click. Nothing goes out without you.',
  },
  {
    q: 'Is connecting my X account safe?',
    a: 'Yes. The X connection is read-only. We use it to learn how you write and to find posts worth replying to — we never post on your behalf without your explicit action.',
  },
  {
    q: 'How does it learn my voice?',
    a: 'Paste a few things you’ve written or import your recent posts. Outloud builds a style guide from your real writing — your cadence, phrasing, and tone — and keeps every draft on-voice.',
  },
  {
    q: 'Can I write in someone else’s voice?',
    a: 'Yes. Alongside your own captured voice, you can pick from a library of creator voices and generate posts in that style.',
  },
  {
    q: 'Will I get shadowbanned?',
    a: 'No. Outloud doesn’t auto-post, spam, or mass-reply — you publish each draft yourself, one at a time, in your own voice. Because posts read like you (not generic AI), they look exactly like normal human activity to the platform.',
  },
  {
    q: 'What happens after the free trial?',
    a: 'You get 3 days free — no card needed — to capture your voice and start posting, with 10,000 credits to use. After that (or once your credits run out), pick a plan to keep going — cancel anytime.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="reveal mx-auto mb-12 max-w-2xl text-center">
        <div className="mb-3 font-code-label text-code-label text-cyber-lime">// FAQ</div>
        <h2 className="font-headline-lg text-headline-lg">
          Questions,{' '}
          <span className="relative inline-block text-electric-indigo">
            answered
            <Underline className="absolute -bottom-2 left-0 h-3 w-full text-cyber-lime" />
          </span>
          .
        </h2>
      </div>

      <div className="reveal mx-auto flex max-w-2xl flex-col gap-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-border-muted bg-surface-container-low p-5 transition-colors open:border-electric-indigo/40 hover:border-white/15"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-body-md text-body-md font-bold text-on-surface marker:content-none [&::-webkit-details-marker]:hidden">
              {f.q}
              <span
                aria-hidden="true"
                className="material-symbols-outlined shrink-0 text-electric-indigo transition-transform duration-200 group-open:rotate-180"
              >
                expand_more
              </span>
            </summary>
            <p className="mt-3 font-body-md text-body-md text-on-surface-variant">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
