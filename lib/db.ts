import { Pool } from 'pg'

// Inlined so it ships in the serverless bundle (reading db/schema.sql from disk
// fails on Vercel — the file isn't traced into the function).
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS early_access_signups (
  id SERIAL PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE early_access_signups ADD COLUMN IF NOT EXISTS email TEXT;

CREATE TABLE IF NOT EXISTS voice_profiles (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  merged_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  style_summary TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_profiles_owner_idx ON voice_profiles (owner_key);
-- At most one active profile per owner.
CREATE UNIQUE INDEX IF NOT EXISTS voice_profiles_one_active_idx
  ON voice_profiles (owner_key) WHERE is_active;
`

let pool: Pool | null = null

// Neon's connection string ships with `channel_binding=require` (breaks node-postgres
// on serverless) and `sslmode=require` (now treated as strict verify-full). Strip both
// and drive TLS ourselves via the `ssl` option below.
function cleanDbUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.searchParams.delete('channel_binding')
    u.searchParams.delete('sslmode')
    return u.toString()
  } catch {
    return raw.replace(/[?&](channel_binding|sslmode)=[^&]*/g, '')
  }
}

export function getPool(): Pool {
  if (!pool) {
    const raw = process.env.DATABASE_URL
    if (!raw) {
      throw new Error('DATABASE_URL is not set')
    }
    // Managed Postgres (Neon/Render/Railway) requires SSL. Enable for those hosts,
    // in production, or when the original URL asked for it.
    const needsSsl =
      process.env.NODE_ENV === 'production' ||
      /sslmode=require/.test(raw) ||
      /\.neon\.tech|\.render\.com|\.railway\./.test(raw)
    pool = new Pool({
      connectionString: cleanDbUrl(raw),
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
