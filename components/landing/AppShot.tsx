// A coded full-app screenshot (sidebar + composer) that fills the scroll-reveal
// card. Renders the real product UI in markup instead of a stock image.
const NAV = [
  { icon: 'edit_square', label: 'New post', active: true },
  { icon: 'reply', label: 'New reply' },
  { icon: 'graphic_eq', label: 'Voices' },
  { icon: 'bookmarks', label: 'Prompts' },
  { icon: 'history', label: 'History' },
]

export function AppShot() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-surface text-left">
      {/* sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border-muted p-4 sm:flex">
        <div className="mb-6 flex items-center gap-2 px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.svg" alt="" className="h-7 w-7" />
          <span className="font-headline-sm text-headline-sm font-bold">Outloud</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <span
              key={n.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 font-body-sm text-body-sm ${
                n.active ? 'bg-electric-indigo/15 text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${n.active ? 'text-electric-indigo' : ''}`}>{n.icon}</span>
              {n.label}
            </span>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 rounded-xl border-t border-border-muted px-2 pt-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-electric-indigo/20 font-code-label text-[11px] text-electric-indigo">E</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">Elen</span>
        </div>
      </aside>

      {/* compose area */}
      <div className="flex min-w-0 flex-1 flex-col p-5 md:p-8">
        <h3 className="mb-1 font-headline-lg text-headline-lg">what do you want to post about, Elen?</h3>
        <p className="mb-6 font-body-sm text-body-sm text-on-surface-variant">Type a rough idea. I’ll write it in your voice.</p>

        <div className="flex flex-1 flex-col justify-end gap-4">
          <div className="self-end max-w-[80%] rounded-2xl rounded-br-md bg-electric-indigo/15 px-4 py-2.5">
            <p className="font-body-sm text-body-sm text-on-surface">shipped dark mode + made exports 2x faster</p>
          </div>

          <div className="rounded-2xl border border-electric-indigo/30 bg-surface-container-low p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-electric-indigo/30 font-code-label text-[11px] text-electric-indigo">E</span>
              <span className="font-code-label text-code-label text-on-surface-variant">in your voice</span>
              <span className="ml-auto flex items-center gap-1 font-code-label text-[11px] text-cyber-lime"><span className="h-1.5 w-1.5 rounded-full bg-cyber-lime" /> ready</span>
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

          <div className="flex items-center gap-3 rounded-2xl border border-border-muted bg-surface-container-low p-3">
            <span className="flex items-center gap-2 rounded-lg border border-border-muted px-3 py-1.5 font-code-label text-code-label text-on-surface-variant">Mode · X post</span>
            <span className="flex items-center gap-2 rounded-lg border border-border-muted px-3 py-1.5 font-code-label text-code-label text-on-surface-variant">Voice · Elen</span>
            <span className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-electric-indigo text-white"><span className="material-symbols-outlined text-[18px]">arrow_upward</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
