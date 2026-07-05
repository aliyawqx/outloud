import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import type {
  ExternalPostIds,
  ScheduledMedia,
  ScheduledPost,
  ScheduledPostSource,
  ScheduledPostStatus,
  SchedulePlatform,
} from './types'

type Row = {
  id: string
  user_id: string
  content: string
  first_reply: string | null
  platforms: SchedulePlatform[]
  media: ScheduledMedia[] | null
  scheduled_for: Date
  timezone: string
  status: ScheduledPostStatus
  source: ScheduledPostSource
  external_post_ids: ExternalPostIds | null
  error: string | null
  retry_count: number
  credits_charged: number
  charge_ledger_id: string | null
  created_at: Date
  updated_at: Date
  published_at: Date | null
}

function mapRow(r: Row): ScheduledPost {
  return {
    id: r.id,
    userId: r.user_id,
    content: r.content,
    firstReply: r.first_reply,
    platforms: r.platforms ?? [],
    media: r.media,
    scheduledFor: r.scheduled_for.toISOString(),
    timezone: r.timezone,
    status: r.status,
    source: r.source,
    externalPostIds: r.external_post_ids,
    error: r.error,
    retryCount: r.retry_count,
    creditsCharged: r.credits_charged,
    chargeLedgerId: r.charge_ledger_id,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
  }
}

export type CreateScheduledPostInput = {
  userId: string
  content: string
  firstReply?: string | null
  platforms: SchedulePlatform[]
  media?: ScheduledMedia[] | null
  scheduledFor: Date
  timezone: string
  source: ScheduledPostSource
  creditsCharged?: number
  chargeLedgerId?: string | null
}

export async function createScheduledPost(input: CreateScheduledPostInput): Promise<ScheduledPost> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `INSERT INTO scheduled_posts
       (id, user_id, content, first_reply, platforms, media, scheduled_for, timezone,
        status, source, credits_charged, charge_ledger_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,$10,$11)
     RETURNING *`,
    [
      randomUUID(),
      input.userId,
      input.content,
      input.firstReply ?? null,
      JSON.stringify(input.platforms),
      input.media && input.media.length ? JSON.stringify(input.media) : null,
      input.scheduledFor,
      input.timezone,
      input.source,
      input.creditsCharged ?? 0,
      input.chargeLedgerId ?? null,
    ],
  )
  return mapRow(r.rows[0])
}

/** Calendar range read. Cancelled posts are hidden from the calendar. */
export async function listScheduledPosts(userId: string, from: Date, to: Date): Promise<ScheduledPost[]> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `SELECT * FROM scheduled_posts
     WHERE user_id = $1 AND scheduled_for >= $2 AND scheduled_for < $3 AND status <> 'cancelled'
     ORDER BY scheduled_for`,
    [userId, from, to],
  )
  return r.rows.map(mapRow)
}

/** The next queued autopilot posts, for the Autopilot settings page. */
export async function listUpcomingAutopilot(userId: string, limit = 5): Promise<ScheduledPost[]> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `SELECT * FROM scheduled_posts
     WHERE user_id = $1 AND source = 'autopilot' AND status = 'scheduled' AND scheduled_for > now()
     ORDER BY scheduled_for LIMIT $2`,
    [userId, limit],
  )
  return r.rows.map(mapRow)
}

export async function getScheduledPost(userId: string, id: string): Promise<ScheduledPost | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(`SELECT * FROM scheduled_posts WHERE user_id = $1 AND id = $2`, [userId, id])
  return r.rows[0] ? mapRow(r.rows[0]) : null
}

export type ScheduledPostPatch = {
  content?: string
  firstReply?: string | null
  platforms?: SchedulePlatform[]
  media?: ScheduledMedia[] | null
  scheduledFor?: Date
  timezone?: string
}

/** Edit a not-yet-fired post. The status guard is IN the SQL so a post that
 *  starts publishing between read and write can't be edited (spec §11). */
export async function updateScheduledPost(userId: string, id: string, patch: ScheduledPostPatch): Promise<ScheduledPost | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `UPDATE scheduled_posts SET
       content        = COALESCE($3, content),
       first_reply    = CASE WHEN $4::boolean THEN $5 ELSE first_reply END,
       platforms      = COALESCE($6, platforms),
       media          = CASE WHEN $7::boolean THEN $8 ELSE media END,
       scheduled_for  = COALESCE($9, scheduled_for),
       timezone       = COALESCE($10, timezone),
       updated_at     = now()
     WHERE user_id = $1 AND id = $2 AND status IN ('draft','scheduled')
     RETURNING *`,
    [
      userId,
      id,
      patch.content ?? null,
      patch.firstReply !== undefined,
      patch.firstReply ?? null,
      patch.platforms ? JSON.stringify(patch.platforms) : null,
      patch.media !== undefined,
      patch.media && patch.media.length ? JSON.stringify(patch.media) : null,
      patch.scheduledFor ?? null,
      patch.timezone ?? null,
    ],
  )
  return r.rows[0] ? mapRow(r.rows[0]) : null
}

/** Soft-cancel (never hard-delete). Only rows that haven't started publishing. */
export async function cancelScheduledPost(userId: string, id: string): Promise<ScheduledPost | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `UPDATE scheduled_posts SET status = 'cancelled', updated_at = now()
     WHERE user_id = $1 AND id = $2 AND status IN ('draft','scheduled','failed')
     RETURNING *`,
    [userId, id],
  )
  return r.rows[0] ? mapRow(r.rows[0]) : null
}

/** Pending autopilot posts sitting in a slot window — the ones "manual wins" evicts. */
export async function findPendingAutopilotInSlot(userId: string, slot: Date, windowMin: number): Promise<ScheduledPost[]> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `SELECT * FROM scheduled_posts
     WHERE user_id = $1 AND source = 'autopilot' AND status = 'scheduled'
       AND scheduled_for > $2::timestamptz - make_interval(mins => $3)
       AND scheduled_for < $2::timestamptz + make_interval(mins => $3)`,
    [userId, slot, windowMin],
  )
  return r.rows.map(mapRow)
}

/** Occupancy for the generation cron: ANY non-cancelled post near the slot blocks it. */
export async function isSlotOccupied(userId: string, slot: Date, windowMin: number): Promise<boolean> {
  await ensureSchema()
  const r = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM scheduled_posts
     WHERE user_id = $1 AND status <> 'cancelled'
       AND scheduled_for > $2::timestamptz - make_interval(mins => $3)
       AND scheduled_for < $2::timestamptz + make_interval(mins => $3)`,
    [userId, slot, windowMin],
  )
  return Number(r.rows[0]?.n ?? '0') > 0
}

/** Due posts for the publish cron scan. */
export async function listDuePostIds(limit: number): Promise<string[]> {
  await ensureSchema()
  const r = await getPool().query<{ id: string }>(
    `SELECT id FROM scheduled_posts
     WHERE status = 'scheduled' AND scheduled_for <= now()
     ORDER BY scheduled_for LIMIT $1`,
    [limit],
  )
  return r.rows.map((x) => x.id)
}

/** Atomic claim — the double-publish guard (spec §6b). Succeeds for exactly one
 *  caller; a second concurrent cron run gets null and must skip the post. */
export async function claimForPublishing(id: string): Promise<ScheduledPost | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `UPDATE scheduled_posts SET status = 'publishing', updated_at = now()
     WHERE id = $1 AND status = 'scheduled'
     RETURNING *`,
    [id],
  )
  return r.rows[0] ? mapRow(r.rows[0]) : null
}

export type PublishOutcome = {
  status: 'published' | 'scheduled' | 'failed' // 'scheduled' = requeued for retry
  externalPostIds: ExternalPostIds
  error: string | null
  retryCount: number
}

export async function finishPublish(id: string, outcome: PublishOutcome): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE scheduled_posts SET
       status = $2,
       external_post_ids = $3,
       error = $4,
       retry_count = $5,
       published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
       updated_at = now()
     WHERE id = $1`,
    [id, outcome.status, JSON.stringify(outcome.externalPostIds), outcome.error, outcome.retryCount],
  )
}

/** Record an internal (unexpected) publish error WITHOUT touching
 *  external_post_ids — a crashed attempt may have partially succeeded, and the
 *  ids the executor already persisted must survive the requeue. */
export async function recordInternalPublishError(
  id: string,
  outcome: { status: 'scheduled' | 'failed'; retryCount: number },
): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE scheduled_posts SET status = $2, error = 'internal error', retry_count = $3, updated_at = now()
     WHERE id = $1`,
    [id, outcome.status, outcome.retryCount],
  )
}
