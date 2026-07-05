import { getSession } from '@/lib/auth/session'
import { getAutopilotSettings } from '@/lib/autopilot/store'
import { getAccount as getLinkedInAccount } from '@/lib/linkedin/store'
import { listUpcomingAutopilot } from '@/lib/schedule/store'
import { getAccount as getXAccount } from '@/lib/x/store'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { AutopilotSettingsPanel } from '@/components/app/autopilot/AutopilotSettingsPanel'
import { LinkedInReconnectBanner } from '@/components/app/LinkedInReconnectBanner'

export const metadata = { title: 'Autopilot — Outloud' }

const EXPIRY_NUDGE_MS = 7 * 86_400_000

export default async function AutopilotPage() {
  const session = await getSession()
  if (!session) return null // layout already redirects unauthenticated users
  const [settings, upcoming, x, threads, li] = await Promise.all([
    getAutopilotSettings(session.userId),
    listUpcomingAutopilot(session.userId, 5),
    getXAccount(session.userId),
    getThreadsAccount(session.userId),
    getLinkedInAccount(session.userId),
  ])
  const needsReconnect = li?.status === 'needs_reconnect'
  const expiring = Boolean(
    li && li.status === 'connected' && !li.hasRefreshToken && li.expiresAt.getTime() - Date.now() < EXPIRY_NUDGE_MS,
  )
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg">Autopilot</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Keeps your calendar full — writes posts in your voice about your interests and fills the empty slots. Your own scheduled posts always win.
        </p>
      </div>
      {(needsReconnect || expiring) && <LinkedInReconnectBanner expiring={!needsReconnect && expiring} />}
      <AutopilotSettingsPanel
        initial={settings}
        upcoming={upcoming}
        xConnected={Boolean(x)}
        threadsConnected={Boolean(threads)}
        linkedInConnected={Boolean(li && li.status === 'connected')}
      />
    </div>
  )
}
