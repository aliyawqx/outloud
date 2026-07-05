// Apply SCHEMA_SQL to the database NOW. DB_SKIP_SCHEMA=1 (set in .env.local and
// prod) makes ensureSchema a no-op at runtime, so after ANY schema change this
// script must be run once per environment: `npx tsx scripts/sync-schema.ts`.
import { readFileSync } from 'node:fs'

// Load .env.local (no dotenv dependency): simple KEY=VALUE lines only.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  // no .env.local (CI / prod shell) — rely on the ambient environment
}
delete process.env.DB_SKIP_SCHEMA // force the DDL to actually run

async function main() {
  const { ensureSchema, getPool } = await import('../lib/db')
  await ensureSchema()
  await getPool().end()
  console.log('schema synced')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
