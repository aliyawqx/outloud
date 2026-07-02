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
        <div className="reveal flex flex-col rounded-3xl border border-border-muted bg-surface-container-low p-6 md:p-7">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border-muted bg-white/5 px-3 py-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-on-surface-variant/70">robot_2</span>
            <span className="font-code-label text-code-label tracking-wide text-on-surface-variant/70">Generic AI</span>
          </div>
          <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant/70 md:text-lg">
            Shipped something small today. I wasn&apos;t even sure this feature would work. Built it anyway,
            tested it, and... it works. A good reminder that the fastest way to answer &apos;will this work?&apos;
            is usually to ship the smallest version and find out.
          </p>
        </div>

        {/* RIGHT — your voice, via Outloud: violet border + soft glow, alive */}
        <div
          className="reveal flex flex-col rounded-3xl border border-[#8447F0] bg-surface-container-low p-6 shadow-[0_0_28px_rgba(132,71,240,0.28)] md:p-7"
          style={{ transitionDelay: '110ms' }}
        >
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#8447F0]/50 bg-[#8447F0]/10 px-3 py-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-[#8447F0]">check_circle</span>
            <span className="font-code-label text-code-label tracking-wide text-[#8447F0]">Your voice, via Outloud</span>
          </div>
          <p className="font-body-md text-body-md leading-relaxed text-on-surface md:text-lg">
            shipped the <span className="text-[#9CCC48]">search and filter</span> for{' '}
            <span className="text-[#9CCC48]">messages</span> today. wasn&apos;t sure it would work. tested it.
            it works. that&apos;s it, the <span className="text-[#9CCC48]">personal crm</span> is getting there.
          </p>
        </div>
      </div>
    </section>
  )
}
