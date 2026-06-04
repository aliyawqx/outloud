'use client'

export function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="glass-panel flex flex-col items-center gap-5 rounded-3xl px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-electric-indigo/15 text-electric-indigo">
        <span className="material-symbols-outlined text-[28px]">graphic_eq</span>
      </span>
      <div>
        <h3 className="font-headline-lg text-headline-lg">Don’t have a voice yet?</h3>
        <p className="mx-auto mt-2 max-w-md font-body-md text-body-md text-on-surface-variant">
          Pick a few creators you admire and we’ll blend them into a single style that’s yours — no blank page, no
          generic AI slop.
        </p>
      </div>
      <button
        type="button"
        onClick={onBrowse}
        className="rounded-full bg-electric-indigo px-7 py-3 font-bold text-white transition-all hover:bg-primary-container active:scale-95"
      >
        Browse creators
      </button>
    </div>
  )
}
