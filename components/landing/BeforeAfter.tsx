// The trust wedge, made visual: the same idea written by generic AI vs. in the
// founder's real voice. Sits high on the page (right under the hero) so the contrast
// is the first thing a visitor feels. The left card's slop (em-dash, hype triad) is
// deliberate — it's the anti-pattern we're calling out.
export function BeforeAfter() {
  return (
    <section aria-label="generic ai vs your voice" className="mx-auto max-w-container-max px-margin-mobile py-20 md:px-margin-desktop">
      <div className="reveal mx-auto mb-12 max-w-2xl text-center">
        <p className="mb-3 font-code-label text-code-label uppercase tracking-[0.12em] text-cyber-lime">// the difference</p>
        <h2 className="mb-3 font-headline-lg text-headline-lg">same idea. one gets you unfollowed.</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">left is what generic ai ships. right is you.</p>
      </div>

      <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-5 md:grid-cols-2">
        {/* LEFT — generic AI (deliberately slop) */}
        <div className="reveal flex flex-col rounded-3xl border border-error/30 bg-surface-container-low p-6">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-error/30 bg-error/10 px-3 py-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-error/80">robot_2</span>
            <span className="font-code-label text-code-label uppercase tracking-widest text-error/80">generic ai</span>
          </div>
          <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant/80">
            In today&apos;s fast-paced startup landscape, we&apos;re thrilled to unveil a game-changing update
            that will revolutionize, streamline, and elevate your workflow — because innovation never sleeps.
          </p>
        </div>

        {/* RIGHT — your voice, via Outloud */}
        <div className="reveal flex flex-col rounded-3xl border border-electric-indigo/50 bg-surface-container-low p-6 shadow-xl" style={{ transitionDelay: '110ms' }}>
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-electric-indigo/40 bg-electric-indigo/10 px-3 py-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-electric-indigo">check_circle</span>
            <span className="font-code-label text-code-label uppercase tracking-widest text-electric-indigo">your voice, via outloud</span>
          </div>
          <p className="font-body-md text-body-md leading-relaxed text-on-surface">
            shipped a thing today i wasn&apos;t sure would work. it works. small win but i&apos;ll take it.
          </p>
        </div>
      </div>
    </section>
  )
}
