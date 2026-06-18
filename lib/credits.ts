import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import type { PoolClient } from 'pg'
import {
  COST_PER_POST,
  COST_PER_REPLY,
  COST_PER_LINK_SEARCH,
  COST_PER_TOPIC_SEARCH,
  COST_PER_AI_PHOTO,
  COST_PER_GOOGLE_PHOTO,
  COST_UPLOAD_PHOTO,
  PLAN_ALLOWANCE,
  FREE_RESET_DAYS,
  SIGNUP_GRANT,
  planAllowance,
  CREDIT_PACKS,
  packById,
  packByProductId,
  SPEND_FEATURES,
  type CreditReason,
} from '@/lib/creditsConfig'

// Re-export the pure config so existing server importers keep using '@/lib/credits'.
export {
  COST_PER_POST,
  COST_PER_REPLY,
  COST_PER_LINK_SEARCH,
  COST_PER_TOPIC_SEARCH,
  COST_PER_AI_PHOTO,
  COST_PER_GOOGLE_PHOTO,
  COST_UPLOAD_PHOTO,
  PLAN_ALLOWANCE,
  FREE_RESET_DAYS,
  SIGNUP_GRANT,
  planAllowance,
  CREDIT_PACKS,
  packById,
  packByProductId,
}
export type { CreditReason }

/** Thrown when a balance can't cover an action. The route turns this into a
 *  structured "buy more credits" response. */
export class InsufficientCreditsError extends Error {
  constructor(public readonly cost: number, public readonly balance: number) {
    super('Not enough credits.')
    this.name = 'InsufficientCreditsError'
  }
}

export async function getBalance(userId: string): Promise<number> {
  await ensureSchema()
  const { rows } = await getPool().query<{ credit_balance: number }>(
    'SELECT credit_balance FROM profiles WHERE user_id = $1',
    [userId],
  )
  return rows[0]?.credit_balance ?? 0
}

/** Append an audit row. `balanceAfter` is the resulting balance; `refId` ties the
 *  row to the post/reply it paid for (nullable). */
async function ledger(
  client: PoolClient,
  userId: string,
  amount: number,
  reason: CreditReason,
  balanceAfter: number,
  refId: string | null = null,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const id = randomUUID()
  await client.query(
    'INSERT INTO credit_ledger (id, user_id, amount, reason, balance_after, ref_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)',
    [id, userId, amount, reason, balanceAfter, refId, JSON.stringify(metadata)],
  )
  return id
}

/**
 * Atomically deduct `cost` for a metered action. Single conditional UPDATE so the
 * balance can NEVER go negative and concurrent calls can't double-spend. Writes a
 * ledger row (with balance_after + ref_id) in the same transaction. Throws
 * InsufficientCreditsError (no deduction) when the balance can't cover it.
 */
export async function deduct(
  userId: string,
  cost: number,
  reason: 'post' | 'reply' | 'search',
  opts: { refId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<{ balance: number; ledgerId: string }> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ credit_balance: number }>(
      'UPDATE profiles SET credit_balance = credit_balance - $2, updated_at = now() WHERE user_id = $1 AND credit_balance >= $2 RETURNING credit_balance',
      [userId, cost],
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      const { rows: b } = await client.query<{ credit_balance: number }>('SELECT credit_balance FROM profiles WHERE user_id = $1', [userId])
      throw new InsufficientCreditsError(cost, b[0]?.credit_balance ?? 0)
    }
    const balanceAfter = rows[0].credit_balance
    const ledgerId = await ledger(client, userId, -cost, reason, balanceAfter, opts.refId ?? null, opts.metadata ?? {})
    await client.query('COMMIT')
    return { balance: balanceAfter, ledgerId }
  } catch (err) {
    if (!(err instanceof InsufficientCreditsError)) {
      try { await client.query('ROLLBACK') } catch {}
    }
    throw err
  } finally {
    client.release()
  }
}

/**
 * Refund a previous deduction (its `ledgerId`) when the paid action failed —
 * generation error, timeout, empty result, or a charge that only yielded a
 * clarifying question. Idempotent: a second refund of the same entry is a no-op,
 * so a retry can't double-credit. Returns the new balance, or null if nothing
 * was refunded. A user must never lose credits for a failed action (spec §5).
 */
export async function refund(userId: string, ledgerId: string): Promise<number | null> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows: orig } = await client.query<{ amount: number; user_id: string }>(
      'SELECT amount, user_id FROM credit_ledger WHERE id = $1 FOR UPDATE',
      [ledgerId],
    )
    const o = orig[0]
    // Only refund a real spend (negative) that belongs to this user.
    if (!o || o.user_id !== userId || o.amount >= 0) {
      await client.query('ROLLBACK')
      return null
    }
    // Idempotency: bail if this entry was already refunded.
    const { rows: dup } = await client.query(
      "SELECT 1 FROM credit_ledger WHERE reason = 'refund' AND metadata->>'refundOf' = $1 LIMIT 1",
      [ledgerId],
    )
    if (dup.length > 0) {
      await client.query('ROLLBACK')
      return null
    }
    const refundAmount = -o.amount // positive credit-back
    const { rows: upd } = await client.query<{ credit_balance: number }>(
      'UPDATE profiles SET credit_balance = credit_balance + $2, updated_at = now() WHERE user_id = $1 RETURNING credit_balance',
      [userId, refundAmount],
    )
    if (upd.length === 0) {
      await client.query('ROLLBACK')
      return null
    }
    const balanceAfter = upd[0].credit_balance
    await ledger(client, userId, refundAmount, 'refund', balanceAfter, null, { refundOf: ledgerId })
    await client.query('COMMIT')
    return balanceAfter
  } catch (err) {
    try { await client.query('ROLLBACK') } catch {}
    throw err
  } finally {
    client.release()
  }
}

/** Reset the balance to the plan's allowance (does NOT stack). Called on subscribe
 *  + each paid renewal. No-op for unknown plans. */
export async function grantPlan(userId: string, plan: string): Promise<void> {
  const amount = PLAN_ALLOWANCE[plan]
  if (amount == null) return
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ credit_balance: number }>(
      'SELECT credit_balance FROM profiles WHERE user_id = $1 FOR UPDATE',
      [userId],
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return
    }
    const prev = rows[0].credit_balance
    // Approximate the monthly reset date (~30d). Exact Polar period would require
    // storing the subscription's current_period_end from the webhook.
    const next = new Date(Date.now() + 30 * 86_400_000)
    await client.query('UPDATE profiles SET credit_balance = $2, credits_reset_at = $3, updated_at = now() WHERE user_id = $1', [userId, amount, next])
    await ledger(client, userId, amount - prev, 'grant', amount, null, { plan, reset: true, previous: prev })
    await client.query('COMMIT')
  } catch (err) {
    try { await client.query('ROLLBACK') } catch {}
    throw err
  } finally {
    client.release()
  }
}

/** Flat-set the balance to the free trial pool (10k), regardless of which plan the
 *  user picked for the trial. Called once at trial start (subscription.created +
 *  status 'trialing'). At conversion, order.paid → grantPlan replaces this with the
 *  full plan allowance (leftover trial credits vanish, per spec §4). */
export async function grantTrialPool(userId: string): Promise<void> {
  await ensureSchema()
  const amount = PLAN_ALLOWANCE.free
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ credit_balance: number }>(
      'SELECT credit_balance FROM profiles WHERE user_id = $1 FOR UPDATE',
      [userId],
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return
    }
    const prev = rows[0].credit_balance
    await client.query('UPDATE profiles SET credit_balance = $2, updated_at = now() WHERE user_id = $1', [userId, amount])
    await ledger(client, userId, amount - prev, 'grant', amount, null, { trial: true, previous: prev })
    await client.query('COMMIT')
  } catch (err) {
    try { await client.query('ROLLBACK') } catch {}
    throw err
  } finally {
    client.release()
  }
}

/**
 * Lazy monthly/weekly reset for FREE accounts: when `credits_reset_at` has passed
 * (or is unset), set the balance to the free allowance, stamp the next reset
 * `FREE_RESET_DAYS` out, and log a 'reset' row. Paid plans reset via Polar renewal,
 * so this is a no-op for them. Returns the new balance if a reset happened, else null.
 * Serialized with a row lock so concurrent requests reset at most once.
 */
export async function resetIfDue(userId: string): Promise<number | null> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ plan: string; credit_balance: number; credits_reset_at: Date | null }>(
      'SELECT plan, credit_balance, credits_reset_at FROM profiles WHERE user_id = $1 FOR UPDATE',
      [userId],
    )
    const r = rows[0]
    if (!r || r.plan !== 'free') {
      await client.query('ROLLBACK')
      return null
    }
    const now = new Date()
    if (r.credits_reset_at && now < r.credits_reset_at) {
      await client.query('ROLLBACK')
      return null
    }
    // Flat reset to the allowance: any leftover (including purchased top-up credits)
    // is wiped on cycle reset, per the monetization decision that top-ups burn when
    // the plan refreshes. Mirrors grantPlan's flat reset on paid renewal.
    const allowance = planAllowance('free')
    const next = new Date(now.getTime() + FREE_RESET_DAYS * 86_400_000)
    await client.query(
      'UPDATE profiles SET credit_balance = $2, credits_reset_at = $3, updated_at = now() WHERE user_id = $1',
      [userId, allowance, next],
    )
    await ledger(client, userId, allowance - r.credit_balance, 'reset', allowance, null, {
      plan: 'free',
      periodDays: FREE_RESET_DAYS,
      previous: r.credit_balance,
    })
    await client.query('COMMIT')
    return allowance
  } catch (err) {
    try { await client.query('ROLLBACK') } catch {}
    throw err
  } finally {
    client.release()
  }
}

/** Add purchased credits (overage packs). Stacks on top of the current balance. */
export async function addCredits(userId: string, credits: number, metadata: Record<string, unknown> = {}): Promise<number> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ credit_balance: number }>(
      'UPDATE profiles SET credit_balance = credit_balance + $2, updated_at = now() WHERE user_id = $1 RETURNING credit_balance',
      [userId, credits],
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return 0
    }
    const balanceAfter = rows[0].credit_balance
    await ledger(client, userId, credits, 'purchase', balanceAfter, null, metadata)
    await client.query('COMMIT')
    return balanceAfter
  } catch (err) {
    try { await client.query('ROLLBACK') } catch {}
    throw err
  } finally {
    client.release()
  }
}

export type UsageFeature = { key: string; label: string; cost: number; count: number; total: number }
export type UsageSummary = {
  balance: number
  /** Plan allowance for the cycle (== `allowance`, kept for the header total). */
  cycleTotal: number
  allowance: number
  /** Credits spent this cycle. `monthUsed` kept as an alias for older callers. */
  cycleUsed: number
  monthUsed: number
  /** ISO reset date (next cycle boundary), or null if unknown. */
  resetAt: string | null
  daily: { date: string; used: number }[]
  byFeature: UsageFeature[]
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Aggregate credit usage for the Usage page — all from the ledger (single source of
 * truth), scoped to the CURRENT cycle. The cycle starts at the last allowance refill
 * ('grant'/'reset' row) and the balance/total/reset come straight from the profile.
 */
export async function getUsage(userId: string): Promise<UsageSummary> {
  await ensureSchema()
  const pool = getPool()
  const { rows: pr } = await pool.query<{ plan: string; credit_balance: number; credits_reset_at: Date | null }>(
    'SELECT plan, credit_balance, credits_reset_at FROM profiles WHERE user_id = $1',
    [userId],
  )
  const plan = pr[0]?.plan ?? 'free'
  const balance = pr[0]?.credit_balance ?? 0
  const cycleTotal = planAllowance(plan)
  const resetAt = pr[0]?.credits_reset_at ? pr[0].credits_reset_at.toISOString() : null

  // Cycle start = the most recent allowance refill (grant/reset). Fall back to the
  // start of the current calendar month if there isn't one yet.
  const { rows: cs } = await pool.query<{ started: Date | null }>(
    "SELECT max(created_at) AS started FROM credit_ledger WHERE user_id = $1 AND reason IN ('grant', 'reset')",
    [userId],
  )
  const cycleStart = cs[0]?.started ?? null
  const cycleClause = cycleStart ? 'created_at >= $2' : "created_at >= date_trunc('month', now())"
  const params = cycleStart ? [userId, cycleStart] : [userId]

  const { rows: u } = await pool.query<{ used: number }>(
    `SELECT COALESCE(-SUM(amount), 0)::int AS used FROM credit_ledger WHERE user_id = $1 AND amount < 0 AND ${cycleClause}`,
    params,
  )
  const cycleUsed = u[0]?.used ?? 0

  // Per-feature counts + totals this cycle, keyed by ledger reason.
  const { rows: fr } = await pool.query<{ reason: string; cnt: number; total: number }>(
    `SELECT reason, count(*)::int AS cnt, COALESCE(-SUM(amount), 0)::int AS total
       FROM credit_ledger WHERE user_id = $1 AND amount < 0 AND ${cycleClause} GROUP BY reason`,
    params,
  )
  const byReason = new Map(fr.map((r) => [r.reason, r]))
  const byFeature: UsageFeature[] = SPEND_FEATURES.map((f) => ({
    key: f.key,
    label: f.label,
    cost: f.cost,
    count: byReason.get(f.reason)?.cnt ?? 0,
    total: byReason.get(f.reason)?.total ?? 0,
  }))

  // One bar per day from cycle start to today (empty days = 0).
  const { rows: d } = await pool.query<{ date: string; used: number }>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, COALESCE(-SUM(amount), 0)::int AS used
       FROM credit_ledger WHERE user_id = $1 AND amount < 0 AND ${cycleClause} GROUP BY 1`,
    params,
  )
  const byDay = new Map(d.map((row) => [row.date, row.used]))
  const today = new Date()
  const start = cycleStart ? new Date(cycleStart) : new Date(today.getFullYear(), today.getMonth(), 1)
  // Cap the graph at ~31 bars so a long/odd cycle can't explode the axis.
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const maxBars = 31
  const spanDays = Math.min(maxBars, Math.max(1, Math.round((today.getTime() - startDay.getTime()) / 86_400_000) + 1))
  const daily: { date: string; used: number }[] = []
  for (let i = spanDays - 1; i >= 0; i--) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = dayKey(dt)
    daily.push({ date: key, used: byDay.get(key) ?? 0 })
  }

  return {
    balance,
    cycleTotal,
    allowance: cycleTotal,
    cycleUsed,
    monthUsed: cycleUsed,
    resetAt,
    daily,
    byFeature,
  }
}
