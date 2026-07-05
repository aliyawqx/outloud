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
    reviewBeforePublish: true,
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
  Pick<AutopilotSettings, 'enabled' | 'interests' | 'postingTimes' | 'timezone' | 'platforms' | 'reviewBeforePublish' | 'slotsPerDay' | 'leadTimeMinutes'>
>

export async function upsertAutopilotSettings(userId: string, patch: AutopilotSettingsPatch): Promise<AutopilotSettings> {
  await ensureSchema()
  const cur = await getAutopilotSettings(userId)
  const next = { ...cur, ...patch }
  const r = await getPool().query<Row>(
    `INSERT INTO autopilot_settings
       (user_id, enabled, interests, posting_times, timezone, platforms,
        review_before_publish, slots_per_day, lead_time_minutes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (user_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       interests = EXCLUDED.interests,
       posting_times = EXCLUDED.posting_times,
       timezone = EXCLUDED.timezone,
       platforms = EXCLUDED.platforms,
       review_before_publish = EXCLUDED.review_before_publish,
       slots_per_day = EXCLUDED.slots_per_day,
       lead_time_minutes = EXCLUDED.lead_time_minutes,
       updated_at = now()
     RETURNING *`,
    [
      userId,
      next.enabled,
      JSON.stringify(next.interests),
      JSON.stringify(next.postingTimes),
      next.timezone,
      JSON.stringify(next.platforms),
      next.reviewBeforePublish,
      next.slotsPerDay,
      next.leadTimeMinutes,
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
