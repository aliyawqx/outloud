import { refund } from '@/lib/credits'
import { SLOT_WINDOW_MINUTES } from './slots'
import { cancelScheduledPost, findPendingAutopilotInSlot, isSlotOccupied } from './store'

/**
 * Manual wins (spec §7): before placing a manual post into a slot, cancel any
 * PENDING autopilot post occupying it (±SLOT_WINDOW_MINUTES) and refund its
 * unpublished charge. Returns how many autopilot posts were evicted.
 */
export async function releaseSlotForManual(userId: string, slot: Date): Promise<number> {
  const pending = await findPendingAutopilotInSlot(userId, slot, SLOT_WINDOW_MINUTES)
  let evicted = 0
  for (const p of pending) {
    const cancelled = await cancelScheduledPost(userId, p.id)
    if (!cancelled) continue // raced into publishing — leave it alone
    evicted++
    if (p.chargeLedgerId && p.creditsCharged > 0 && !p.publishedAt) {
      await refund(userId, p.chargeLedgerId).catch((e) => console.error('[schedule/conflict] refund failed:', e))
    }
  }
  return evicted
}

/** Generation-cron side of the same rule: ANY non-cancelled post near the slot
 *  (manual OR autopilot) blocks autopilot from filling it. Same window. */
export async function slotOccupied(userId: string, slot: Date): Promise<boolean> {
  return isSlotOccupied(userId, slot, SLOT_WINDOW_MINUTES)
}
