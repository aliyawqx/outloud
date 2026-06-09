import Link from 'next/link'

// Top promo bar: everyone starts on a 3-day free trial. Replaces the old $1
// founders bar. Kept copy generic (no draft-cap detail) for the landing pages.
export function TrialBanner({ sticky = false }: { sticky?: boolean }) {
  return (
    <div
      className={`${sticky ? 'sticky top-0' : ''} z-[60] w-full bg-gradient-to-r from-electric-indigo to-secondary text-white shadow-lg shadow-electric-indigo/25`}
    >
      <div className="mx-auto flex max-w-container-max flex-wrap items-center justify-center gap-x-3 gap-y-2 px-margin-mobile py-2.5 text-center md:px-margin-desktop">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">bolt</span>
        <span className="font-body-sm text-body-sm font-bold uppercase tracking-wide">
          Start free — 3 days on us, no card needed
        </span>
        <Link
          href="/signup"
          className="rounded-full bg-white px-4 py-1 font-code-label text-code-label font-bold text-electric-indigo transition-transform hover:scale-105 active:scale-95"
        >
          Start free
        </Link>
      </div>
    </div>
  )
}
