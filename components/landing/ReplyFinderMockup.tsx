// Coded mockup of the Reply finder: Outloud surfaces a high-reach post in your
// niche, judges it worth replying to, and drafts a reply in your voice.
export function ReplyFinderMockup() {
  return (
    <div className="glass-card overflow-hidden rounded-3xl border-white/10">
      <div className="flex items-center gap-2 border-b border-border-muted px-5 py-3">
        <span className="material-symbols-outlined text-[16px] text-electric-indigo">travel_explore</span>
        <span className="font-code-label text-code-label text-on-surface-variant">reply finder · “build in public”</span>
      </div>

      <div className="flex flex-col gap-3 p-5">
        {/* a candidate post in your niche */}
        <div className="rounded-2xl border border-border-muted bg-surface-container-low p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-2 py-0.5 font-code-label text-[10px] uppercase text-cyber-lime">reply</span>
            <span className="font-body-sm text-body-sm font-bold text-on-surface">Big Founder</span>
            <span className="font-code-label text-[11px] text-on-surface-variant">@bigfounder · 2h</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface">“most build-in-public posts are noise. share the number that actually moved, or don’t post.”</p>
          <div className="mt-2 flex gap-4 font-code-label text-[11px] text-on-surface-variant/70">
            <span>180k followers</span>
            <span>♥ 1.2k</span>
            <span>↺ 140</span>
          </div>
        </div>

        {/* your reply, drafted in your voice */}
        <div className="rounded-2xl border border-electric-indigo/30 bg-surface-container-low p-4">
          <div className="mb-1.5 font-code-label text-code-label text-on-surface-variant">your reply</div>
          <p className="font-body-md text-on-surface">
            been doing this. the post that did 6.9k for me was just “16k saw it, 19 clicked.” the ugly number is the one people actually stop for.
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-1.5 font-code-label text-code-label text-white">
            <span className="material-symbols-outlined text-[15px]">reply</span> Reply on X
          </span>
        </div>
      </div>
    </div>
  )
}
