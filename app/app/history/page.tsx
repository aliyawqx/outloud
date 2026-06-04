import Link from 'next/link'

export const metadata = { title: 'Outloud | History' }

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-headline-xl text-headline-xl">History</h1>
      <p className="mb-6 font-body-md text-body-md text-on-surface-variant">Your past drafts and compose sessions.</p>

      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border-muted px-6 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-electric-indigo/15 text-electric-indigo">
          <span className="material-symbols-outlined text-[28px]">history</span>
        </span>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Nothing here yet. Write your first post and it’ll show up here.
        </p>
        <Link
          href="/app"
          className="rounded-full bg-electric-indigo px-6 py-2.5 font-bold text-white transition-all hover:bg-primary-container active:scale-95"
        >
          Start one
        </Link>
      </div>
    </div>
  )
}
