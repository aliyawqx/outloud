import { ensureSchema, getPool } from '@/lib/db'
import type { SchedulePlatform } from '@/lib/schedule/types'
import type { PostingTime } from '@/lib/schedule/slots'

export type AutopilotSettings = {
  userId: string
  enabled: boolean
  interests: string[]
  postingTimes: PostingTime[]
  timezone: string
  platforms: SchedulePlatform[]
  reviewBeforePublish: boolean
  /** Attach an AI-generated image to each auto post (extra COST_PER_AI_PHOTO). */
  aiImages: boolean
  slotsPerDay: number
  leadTimeMinutes: number
  pausedAt: string | null
  pauseReason: string | null
}

type Row = {
  user_id: string
  enabled: boolean
  interests: string[]
  posting_times: PostingTime[]
  timezone: string
  platforms: SchedulePlatform[]
  review_before_publish: boolean
  ai_images: boolean
  slots_per_day: number
  lead_time_minutes: number
  paused_at: Date | null
  pause_reason: string | null
}

function mapRow(r: Row): AutopilotSettings {
  return {
    userId: r.user_id,
    enabled: r.enabled,
    interests: r.interests ?? [],
    postingTimes: r.posting_times ?? [],
    timezone: r.timezone,
    platforms: r.platforms ?? [],
    reviewBeforePublish: r.review_before_publish,
    aiImages: r.ai_images,
    slotsPerDay: r.slots_per_day,
    leadTimeMinutes: r.lead_time_minutes,
    pausedAt: r.paused_at ? r.paused_at.toISOString() : null,
    pauseReason: r.pause_reason,
  }
}

function defaults(userId: string): AutopilotSettings {
  return {
    userId,
    enabled: false,
    interests: [],
    postingTimes: [],
    timezone: 'UTC',
    platforms: [],
    reviewBeforePublish: false, // zero-touch default (addendum): publish without a review gate
    aiImages: false,
    slotsPerDay: 1,
    leadTimeMinutes: 240,
    pausedAt: null,
    pauseReason: null,
  }
}

export async function getAutopilotSettings(userId: string): Promise<AutopilotSettings> {
  await ensureSchema()
  const r = await getPool().query<Row>(`SELECT * FROM autopilot_settings WHERE user_id = $1`, [userId])
  return r.rows[0] ? mapRow(r.rows[0]) : defaults(userId)
}

export type AutopilotSettingsPatch = Partial<
  Pick<AutopilotSettings, 'enabled' | 'interests' | 'postingTimes' | 'timezone' | 'platforms' | 'reviewBeforePublish' | 'aiImages' | 'slotsPerDay' | 'leadTimeMinutes'>
>

export async function upsertAutopilotSettings(userId: string, patch: AutopilotSettingsPatch): Promise<AutopilotSettings> {
  await ensureSchema()
  // Per-column COALESCE patch (not read-merge-write) so concurrent partial saves can't overwrite each other's columns.
  await getPool().query(`INSERT INTO autopilot_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId])
  const r = await getPool().query<Row>(
    `UPDATE autopilot_settings SET
       enabled               = COALESCE($2::boolean, enabled),
       interests             = COALESCE($3::jsonb, interests),
       posting_times         = COALESCE($4::jsonb, posting_times),
       timezone              = COALESCE($5::text, timezone),
       platforms             = COALESCE($6::jsonb, platforms),
       review_before_publish = COALESCE($7::boolean, review_before_publish),
       ai_images             = COALESCE($8::boolean, ai_images),
       slots_per_day         = COALESCE($9::int, slots_per_day),
       lead_time_minutes     = COALESCE($10::int, lead_time_minutes),
       updated_at            = now()
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      patch.enabled ?? null,
      patch.interests !== undefined ? JSON.stringify(patch.interests) : null,
      patch.postingTimes !== undefined ? JSON.stringify(patch.postingTimes) : null,
      patch.timezone ?? null,
      patch.platforms !== undefined ? JSON.stringify(patch.platforms) : null,
      patch.reviewBeforePublish ?? null,
      patch.aiImages ?? null,
      patch.slotsPerDay ?? null,
      patch.leadTimeMinutes ?? null,
    ],
  )
  return mapRow(r.rows[0])
}

export async function pauseAutopilot(userId: string, reason: string): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE autopilot_settings SET paused_at = now(), pause_reason = $2, updated_at = now() WHERE user_id = $1`,
    [userId, reason],
  )
}

export async function resumeAutopilot(userId: string): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE autopilot_settings SET paused_at = NULL, pause_reason = NULL, updated_at = now() WHERE user_id = $1`,
    [userId],
  )
}

/** Users paused for credits (M9) — the cron's auto-resume sweep input. */
export async function listCreditPausedUserIds(limit = 20): Promise<string[]> {
  await ensureSchema()
  const r = await getPool().query<{ user_id: string }>(
    `SELECT user_id FROM autopilot_settings
     WHERE enabled AND paused_at IS NOT NULL AND pause_reason = 'insufficient_credits'
     ORDER BY paused_at LIMIT $1`,
    [limit],
  )
  return r.rows.map((x) => x.user_id)
}

export type AutopilotCandidate = { settings: AutopilotSettings; email: string }

/** Users the generation cron should serve: enabled and not paused. Email is
 *  joined in for the isStaff() unlimited-credits bypass. */
export async function listAutopilotCandidates(): Promise<AutopilotCandidate[]> {
  await ensureSchema()
  const r = await getPool().query<Row & { email: string }>(
    `SELECT a.*, u.email FROM autopilot_settings a
     JOIN users u ON u.id = a.user_id
     WHERE a.enabled AND a.paused_at IS NULL
     ORDER BY a.updated_at`,
  )
  return r.rows.map((row) => ({ settings: mapRow(row), email: row.email }))
}
