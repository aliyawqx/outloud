import { Pool } from 'pg'

// Inlined so it ships in the serverless bundle (reading db/schema.sql from disk
// fails on Vercel — the file isn't traced into the function).
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS early_access_signups (
  id SERIAL PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    // Managed Postgres (Neon/Render/Railway) requires SSL. Enable it whenever the
    // URL asks for it or we're in production; skip for a plain local Postgres.
    const needsSsl =
      process.env.NODE_ENV === 'production' ||
      /sslmode=require/.test(connectionString) ||
      /\.neon\.tech|\.render\.com|\.railway\./.test(connectionString)
    pool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    })
  }
  return pool
}

let schemaReady: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        // Reset so a later request can retry after a transient failure.
        schemaReady = null
        throw err
      })
  }
  return schemaReady
}

export type UpsertInput = {
  handle: string
  email: string
}

export async function upsertSignup(input: UpsertInput): Promise<{ alreadyOnList: boolean }> {
  const result = await getPool().query<{ inserted: boolean }>(
    `INSERT INTO early_access_signups (handle, email)
     VALUES ($1, $2)
     ON CONFLICT (handle)
     DO UPDATE SET email = EXCLUDED.email
     RETURNING (xmax = 0) AS inserted`,
    [input.handle, input.email],
  )
  const inserted = result.rows[0]?.inserted ?? true
  return { alreadyOnList: !inserted }
}
