import { addNotification } from '@/lib/notifications/store'
import { sendAutopilotPausedEmail } from '@/lib/notify'
import { getAutopilotSettings, pauseAutopilot, resumeAutopilot } from './store'

// M9/M10 (billing spec): the ONE pause-for-credits path (in-app + email, never
// silent) and its auto-resume twin (refill or top-up brings autopilot back
// without the user touching anything).

export async function pauseForCredits(userId: string, email?: string): Promise<void> {
  await pauseAutopilot(userId, 'insufficient_credits')
  await addNotification({
    userId,
    kind: 'autopilot_paused',
    title: 'autopilot paused — not enough credits',
    body: 'top up in billing or wait for your monthly refill — it resumes on its own.',
    link: '/app/settings/billing',
  }).catch(() => {})
  if (email) await sendAutopilotPausedEmail(email)
}

/** Resume ONLY an insufficient_credits pause (never a user-initiated one).
 *  Returns true when it actually resumed. */
export async function resumeIfCreditPaused(userId: string): Promise<boolean> {
  const s = await getAutopilotSettings(userId)
  if (!s.pausedAt || s.pauseReason !== 'insufficient_credits') return false
  await resumeAutopilot(userId)
  return true
}
