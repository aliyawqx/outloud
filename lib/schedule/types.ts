// The ONE calendar's row shape. Manual and autopilot posts share this table —
// there are no separate modes, just two sources feeding the same calendar.

export type SchedulePlatform = 'x' | 'threads' | 'linkedin'
export type ScheduledPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'
export type ScheduledPostSource = 'manual' | 'autopilot'
export type ScheduledMedia = { url: string; alt?: string }
export type ExternalPostIds = Partial<Record<SchedulePlatform, string>>

export type ScheduledPost = {
  id: string
  userId: string
  content: string
  firstReply: string | null
  platforms: SchedulePlatform[]
  media: ScheduledMedia[] | null
  scheduledFor: string // ISO, UTC
  timezone: string // IANA, for display + slot math
  status: ScheduledPostStatus
  source: ScheduledPostSource
  externalPostIds: ExternalPostIds | null
  /** Live links to the published post, keyed by platform (addendum B). Only
   *  'published' posts carry these; failed platforms get an error, not a link. */
  permalinks: Partial<Record<SchedulePlatform, string>> | null
  error: string | null
  retryCount: number
  creditsCharged: number
  chargeLedgerId: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export const SCHEDULE_PLATFORMS: SchedulePlatform[] = ['x', 'threads', 'linkedin']

export function isSchedulePlatform(v: unknown): v is SchedulePlatform {
  return v === 'x' || v === 'threads' || v === 'linkedin'
}

/** Display names — ONE source so the composer, modals, calendar and settings match. */
export function platformLabel(p: SchedulePlatform): string {
  return p === 'x' ? 'X' : p === 'threads' ? 'Threads' : 'LinkedIn'
}

/** Compact calendar-chip label. */
export function platformShort(p: SchedulePlatform): string {
  return p === 'x' ? 'X' : p === 'threads' ? 'Th' : 'Li'
}
