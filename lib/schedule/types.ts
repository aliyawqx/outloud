// The ONE calendar's row shape. Manual and autopilot posts share this table —
// there are no separate modes, just two sources feeding the same calendar.

export type SchedulePlatform = 'x' | 'threads'
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
  error: string | null
  retryCount: number
  creditsCharged: number
  chargeLedgerId: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export const SCHEDULE_PLATFORMS: SchedulePlatform[] = ['x', 'threads']

export function isSchedulePlatform(v: unknown): v is SchedulePlatform {
  return v === 'x' || v === 'threads'
}
