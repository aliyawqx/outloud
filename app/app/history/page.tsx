import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { listComposeHistory } from '@/lib/voice/history'
import { HistoryList } from '@/components/app/HistoryList'

export const metadata = { title: 'Outloud | History' }

export default async function HistoryPage() {
  const session = await getSession()
  if (!session) return null
  const entries = await listComposeHistory(session.userId)

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-headline-xl text-headline-xl">History</h1>
      <p className="mb-6 font-body-md text-body-md text-on-surface-variant">Your past drafts and compose sessions.</p>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border-muted px-6 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-electric-indigo/15 text-electric-indigo">
            <span aria-hidden="true" className="material-symbols-outlined text-[28px]">history</span>
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
      ) : (
        <HistoryList initial={entries} />
      )}
    </div>
  )
}
