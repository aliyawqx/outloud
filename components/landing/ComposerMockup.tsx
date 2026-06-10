// A coded mockup of the Outloud composer (idea -> post in your voice). We render
// the real product UI in markup rather than shipping a screenshot PNG, so it stays
// crisp and on-brand. Used as the hero centerpiece and in the highlights cards.
export function ComposerMockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="glass-card overflow-hidden rounded-3xl border-white/10 shadow-2xl">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border-muted px-5 py-3">
        <span className="h-3 w-3 rounded-full bg-error/40" />
        <span className="h-3 w-3 rounded-full bg-secondary/40" />
        <span className="h-3 w-3 rounded-full bg-electric-indigo/40" />
        <span className="ml-3 font-code-label text-code-label text-on-surface-variant">outloud · compose</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-border-muted px-2.5 py-1 font-code-label text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px] text-electric-indigo">graphic_eq</span>
          wqx · your voice
        </span>
      </div>

      <div className={`flex flex-col gap-4 p-5 ${compact ? '' : 'md:p-6'}`}>
        {/* the rough idea */}
        <div className="self-end max-w-[80%] rounded-2xl rounded-br-md bg-electric-indigo/15 px-4 py-2.5">
          <p className="font-body-sm text-body-sm text-on-surface">shipped dark mode + made exports 2x faster</p>
        </div>

        {/* generated draft in your voice */}
        <div className="rounded-2xl border border-electric-indigo/30 bg-surface-container-low p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-electric-indigo/30 font-code-label text-[11px] text-electric-indigo">W</span>
            <span className="font-code-label text-code-label text-on-surface-variant">in your voice</span>
            <span className="ml-auto flex items-center gap-1 font-code-label text-[11px] text-cyber-lime">
              <span className="h-1.5 w-1.5 rounded-full bg-cyber-lime ai-pulse" /> ready
            </span>
          </div>
          <p className="font-body-md leading-relaxed text-on-surface">
            dark mode shipped. exports run 2x faster now. spent the afternoon fighting a cache bug that turned out to be one missing await. one line. classic.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-1.5 font-code-label text-code-label text-white">
              <span className="material-symbols-outlined text-[15px]">send</span> Post to X
            </span>
            <span className="font-code-label text-[11px] text-on-surface-variant/60">182 chars</span>
          </div>
        </div>
      </div>
    </div>
  )
}
