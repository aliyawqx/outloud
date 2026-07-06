import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'

// Lightweight in-app notifications (spec §8) — a table + a bell, no heavy system.
export type NotificationKind =
  | 'autopilot_queued'
  | 'autopilot_paused'
  | 'publish_failed'
  | 'reconnect_needed'
  | 'low_credits'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  refId: string | null
  readAt: string | null
  createdAt: string
}

type Row = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  ref_id: string | null
  read_at: Date | null
  created_at: Date
}

const mapRow = (r: Row): AppNotification => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  refId: r.ref_id,
  readAt: r.read_at ? r.read_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
})

export async function addNotification(input: {
  userId: string
  kind: NotificationKind
  title: string
  body?: string
  refId?: string
}): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `INSERT INTO notifications (id, user_id, kind, title, body, ref_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), input.userId, input.kind, input.title, input.body ?? null, input.refId ?? null],
  )
}

export async function listNotifications(userId: string, limit = 20): Promise<AppNotification[]> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  )
  return r.rows.map(mapRow)
}

/** Dedupe helper: was a notification of this kind created recently? */
export async function hasRecentNotification(userId: string, kind: NotificationKind, withinMs: number): Promise<boolean> {
  await ensureSchema()
  const r = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications
     WHERE user_id = $1 AND kind = $2 AND created_at > now() - make_interval(secs => $3)`,
    [userId, kind, Math.floor(withinMs / 1000)],
  )
  return Number(r.rows[0]?.n ?? '0') > 0
}

export async function unreadCount(userId: string): Promise<number> {
  await ensureSchema()
  const r = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  )
  return Number(r.rows[0]?.n ?? '0')
}

export async function markAllRead(userId: string): Promise<void> {
  await ensureSchema()
  await getPool().query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId])
}
