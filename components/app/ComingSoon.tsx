export function ComingSoon({ title, icon, blurb }: { title: string; icon: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-headline-xl text-headline-xl">{title}</h1>
      <div className="mt-6 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border-muted px-6 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-electric-indigo/15 text-electric-indigo">
          <span className="material-symbols-outlined text-[28px]">{icon}</span>
        </span>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">{blurb}</p>
        <span className="rounded-full border border-border-muted px-3 py-1 font-code-label text-code-label uppercase text-on-surface-variant/60">
          Coming soon
        </span>
      </div>
    </div>
  )
}
