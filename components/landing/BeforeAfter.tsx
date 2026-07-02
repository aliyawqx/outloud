// The trust wedge, made visual: the same idea written by generic AI vs. in the
// founder's real voice. Sits high on the page (right under the hero) so the contrast
// is the first thing a visitor feels. The left card's slop (em-dash, hype triad) is
// deliberate — it's the anti-pattern we're calling out.
export function BeforeAfter() {
  return (
    <section aria-label="generic ai vs your voice" className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="reveal mx-auto mb-12 max-w-2xl text-center">
        <p className="mb-3 font-code-label text-code-label uppercase tracking-[0.12em] text-cyber-lime">// The difference</p>
        <h2 className="mb-3 font-headline-lg text-headline-lg">Same idea. One gets you unfollowed.</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Left is what generic AI ships. Right is what Outloud gives you.</p>
      </div>

      <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-5 md:grid-cols-2">
        {/* LEFT — generic AI: flat, muted, forgettable */}
        <div className="reveal flex flex-col rounded-3xl border border-border-muted bg-surface-container-low p-6">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border-muted bg-white/5 px-3 py-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-on-surface-variant/70">robot_2</span>
            <span className="font-code-label text-code-label tracking-wide text-on-surface-variant/70">Generic AI</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border-muted bg-surface-container-lowest">
            <img
              src="/before-after/generic-ai.png"
              alt="Generic AI writing a bland, forgettable founder post"
              className="h-[300px] w-full object-contain md:h-[340px]"
              loading="lazy"
            />
          </div>
        </div>

        {/* RIGHT — your voice, via Outloud: violet border + soft glow, alive */}
        <div
          className="reveal flex flex-col rounded-3xl border border-electric-indigo bg-surface-container-low p-6"
          style={{ transitionDelay: '110ms', boxShadow: '0 0 28px rgba(176, 107, 255, 0.28)' }}
        >
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-electric-indigo/40 bg-electric-indigo/10 px-3 py-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-electric-indigo">check_circle</span>
            <span className="font-code-label text-code-label tracking-wide text-electric-indigo">Your voice, via Outloud</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-electric-indigo/30 bg-surface-container-lowest">
            <img
              src="/before-after/outloud-draft.png"
              alt="Outloud drafting the same post in your writing voice"
              className="h-[300px] w-full object-contain md:h-[340px]"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
