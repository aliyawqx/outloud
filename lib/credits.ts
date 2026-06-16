import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'

// ── Single source of truth for credit costs / grants ───────────────────────────
export const POST_COST = 500
export const SEARCH_COST = 10_000

/** Monthly grant per paid plan. Reset (NOT stacked) on subscribe + each renewal. */
export const PLAN_GRANTS: Record<string, number> = {
  starter: 200_000,
  pro: 800_000,
}

/** Credits a brand-new free account starts with so the trial works (outside the
 *  paid PLAN_GRANTS). */
export const SIGNUP_GRANT = 5_000

/** Overage credit packs — bought via Polar checkout. `productEnv` names the Polar
 *  product id env var for that pack. */
export const CREDIT_PACKS = [
  { id: 'pack_100k', label: '100,000 credits', credits: 100_000, productEnv: 'POLAR_PACK_100K_PRODUCT_ID' },
  { id: 'pack_500k', label: '500,000 credits', credits: 500_000, productEnv: 'POLAR_PACK_500K_PRODUCT_ID' },
  { id: 'pack_1m', label: '1,000,000 credits', credits: 1_000_000, productEnv: 'POLAR_PACK_1M_PRODUCT_ID' },
] as const

export type CreditReason = 'grant' | 'post' | 'search' | 'purchase'

export function packById(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null
}
/** Reverse lookup for the webhook: which pack a paid Polar product id is. */
export function packByProductId(productId: string | undefined | null) {
  if (!productId) return null
  return CREDIT_PACKS.find((p) => process.env[p.productEnv] === productId) ?? null
}

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

async function ledger(client: import('pg').PoolClient, userId: string, amount: number, reason: CreditReason, metadata: Record<string, unknown>) {
  await client.query(
    'INSERT INTO credit_ledger (id, user_id, amount, reason, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)',
    [randomUUID(), userId, amount, reason, JSON.stringify(metadata)],
  )
}

/**
 * Atomically deduct `cost` for a metered action. Single conditional UPDATE so the
 * balance can NEVER go negative and concurrent calls can't double-spend. Writes a
 * ledger row in the same transaction. Throws InsufficientCreditsError (no deduction)
 * when the balance can't cover it.
 */
export async function deduct(userId: string, cost: number, reason: 'post' | 'search', metadata: Record<string, unknown> = {}): Promise<number> {
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
    await ledger(client, userId, -cost, reason, metadata)
    await client.query('COMMIT')
    return rows[0].credit_balance
  } catch (err) {
    if (!(err instanceof InsufficientCreditsError)) {
      try { await client.query('ROLLBACK') } catch {}
    }
    throw err
  } finally {
    client.release()
  }
}

/** Reset the balance to the plan's monthly grant (does NOT stack). Called on
 *  subscribe + each renewal. No-op for plans without a grant (e.g. 'free'). */
export async function grantPlan(userId: string, plan: string): Promise<void> {
  const amount = PLAN_GRANTS[plan]
  if (!amount) return
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
    await client.query('UPDATE profiles SET credit_balance = $2, updated_at = now() WHERE user_id = $1', [userId, amount])
    await ledger(client, userId, amount - prev, 'grant', { plan, reset: true, previous: prev })
    await client.query('COMMIT')
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
    await ledger(client, userId, credits, 'purchase', metadata)
    await client.query('COMMIT')
    return rows[0].credit_balance
  } catch (err) {
    try { await client.query('ROLLBACK') } catch {}
    throw err
  } finally {
    client.release()
  }
}
