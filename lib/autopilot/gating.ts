import { refund } from '@/lib/credits'
import { addNotification } from '@/lib/notifications/store'
import { cancelScheduledPost, listUpcomingAutopilot } from '@/lib/schedule/store'
import { getAutopilotSettings, upsertAutopilotSettings } from './store'

// Downgrade handling (plan-gating spec §6, recommended option): the moment a
// user is no longer Pro, autopilot turns off and pending auto posts are
// cancelled (with charged-but-unpublished ones refunded via the existing
// helper). Manual posts, scheduled manual posts and the calendar are
// untouched. Called lazily by the generation cron's defensive re-check AND
// eagerly by the Polar webhook on subscription.revoked.
export async function dropAutopilotForNonPro(userId: string): Promise<boolean> {
  const settings = await getAutopilotSettings(userId)
  if (!settings.enabled) return false

  await upsertAutopilotSettings(userId, { enabled: false })

  const pending = await listUpcomingAutopilot(userId, 100)
  for (const p of pending) {
    const cancelled = await cancelScheduledPost(userId, p.id)
    if (cancelled && p.chargeLedgerId && p.creditsCharged > 0 && !p.publishedAt) {
      await refund(userId, p.chargeLedgerId).catch((e) => console.error('[autopilot/gating] refund failed:', e))
    }
  }

  await addNotification({
    userId,
    kind: 'autopilot_paused',
    title: 'autopilot is off — pro ended',
    body: 'your pro plan ended, so autopilot stopped and queued auto posts were cancelled. your manual posts and calendar are untouched. upgrade to turn it back on.',
    link: '/pricing',
  }).catch(() => {})
  return true
}
