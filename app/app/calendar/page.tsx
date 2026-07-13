import { getSession } from '@/lib/auth/session'
import { getAccount as getLinkedInAccount } from '@/lib/linkedin/store'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { getAccount as getXAccount } from '@/lib/x/store'
import { CalendarView } from '@/components/app/calendar/CalendarView'
import { LinkedInReconnectBanner } from '@/components/app/LinkedInReconnectBanner'

export const metadata = { title: 'Calendar - Outloud' }

const EXPIRY_NUDGE_MS = 7 * 86_400_000

export default async function CalendarPage() {
  const session = await getSession()
  const [li, x, threads] = session
    ? await Promise.all([
        getLinkedInAccount(session.userId),
        getXAccount(session.userId),
        getThreadsAccount(session.userId),
      ])
    : [null, null, null]
  const needsReconnect = li?.status === 'needs_reconnect'
  const expiring = Boolean(
    li && li.status === 'connected' && !li.hasRefreshToken && li.expiresAt.getTime() - Date.now() < EXPIRY_NUDGE_MS,
  )
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg">Calendar</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Everything queued to publish - your scheduled posts and autopilot&apos;s, side by side.
        </p>
      </div>
      {(needsReconnect || expiring) && <LinkedInReconnectBanner expiring={!needsReconnect && expiring} />}
      <CalendarView
        connected={{
          x: Boolean(x),
          threads: Boolean(threads),
          linkedin: Boolean(li && li.status === 'connected'),
        }}
      />
    </div>
  )
}
