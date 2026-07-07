// One-off backfill for the canonical billing fields (billing spec §7).
// Idempotent — safe to re-run. Usage: npx tsx scripts/backfill-billing.ts
import { readFileSync } from 'node:fs'

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}
delete process.env.DB_SKIP_SCHEMA

async function main() {
  const { getPool, ensureSchema } = await import('../lib/db')
  const { PLAN_ALLOWANCE } = await import('../lib/creditsConfig')
  await ensureSchema()
  const pool = getPool()

  // Paid plans → active, allotment from the plan table.
  for (const plan of ['starter', 'pro', 'founder'] as const) {
    const r = await pool.query(
      `UPDATE profiles SET plan_status='active', credits_allotment=$2 WHERE plan=$1 AND (plan_status <> 'active' OR credits_allotment IS DISTINCT FROM $2)`,
      [plan, PLAN_ALLOWANCE[plan]],
    )
    console.log(plan, '→ active:', r.rowCount)
  }
  // Free with a live card-free trial → trialing (trial_ends_at mirrors the window).
  const t = await pool.query(
    `UPDATE profiles SET plan_status='trialing', trial_ends_at=credits_reset_at, credits_allotment=$1
     WHERE plan='free' AND trialing AND credit_balance > 0 AND credits_reset_at > now()`,
    [PLAN_ALLOWANCE.free],
  )
  console.log('free trialing:', t.rowCount)
  // Remaining free → expired.
  const e = await pool.query(
    `UPDATE profiles SET plan_status='expired', credits_allotment=$1
     WHERE plan='free' AND plan_status IS DISTINCT FROM 'expired'
       AND NOT (trialing AND credit_balance > 0 AND credits_reset_at IS NOT NULL AND credits_reset_at > now())`,
    [PLAN_ALLOWANCE.free],
  )
  console.log('free expired:', e.rowCount)
  await pool.end()
  console.log('backfill done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
