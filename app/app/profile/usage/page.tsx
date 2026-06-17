import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { UsagePanel } from '@/components/app/UsagePanel'

export const metadata = { title: 'Outloud | Usage' }

export default async function UsagePage() {
  const session = await getSession()
  if (!session) return null
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/app/profile" className="font-code-label text-code-label text-on-surface-variant hover:text-on-surface">
        ← Profile
      </Link>
      <h1 className="mb-1 mt-3 font-headline-xl text-headline-xl">Usage</h1>
      <p className="mb-8 font-body-md text-body-md text-on-surface-variant">
        Your credit usage over the last 7 days and this month.
      </p>
      <UsagePanel />
    </div>
  )
}
