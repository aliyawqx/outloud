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

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Email verification (code sent after signup). New users start unverified; existing
-- rows are grandfathered to true by a one-time backfill.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_code_expires TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  handle TEXT,
  avatar_url TEXT,
  email TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Access gate: nFactorial incubator participation (null = not asked yet) + a
-- lifetime draft cap counter for participants.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS incubator TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drafts_used INTEGER NOT NULL DEFAULT 0;

-- Credit system: cached balance on the profile (source of truth), with every
-- change also appended to credit_ledger as an audit trail. Deduction is an atomic
-- conditional UPDATE (balance never goes negative).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_ledger (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  amount     INTEGER NOT NULL,                 -- signed: grants/purchases +, spends -
  reason     TEXT NOT NULL,                    -- 'grant' | 'post' | 'search' | 'purchase'
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON credit_ledger (user_id, created_at DESC);

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
-- Captured Style Guide (own-voice) + channel.
ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS style_guide TEXT NOT NULL DEFAULT '';
ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'x';

-- Writing samples ingested for own-voice capture.
CREATE TABLE IF NOT EXISTS writing_samples (
  id TEXT PRIMARY KEY,
  voice_profile_id TEXT NOT NULL REFERENCES voice_profiles(id) ON DELETE CASCADE,
  owner_key TEXT NOT NULL,
  source TEXT NOT NULL,
  text TEXT NOT NULL,
  used_in_style BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS writing_samples_profile_idx ON writing_samples (voice_profile_id);

CREATE TABLE IF NOT EXISTS compose_history (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  voice_profile_id TEXT,
  voice_name TEXT NOT NULL DEFAULT '',
  idea TEXT NOT NULL,
  drafts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compose_history_owner_idx ON compose_history (owner_key, created_at DESC);
-- Full chat transcript (user/assistant turns + draft turns) so a session can be
-- reopened in the composer and continued.
ALTER TABLE compose_history ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '[]'::jsonb;
-- When a session is a reply (Reply Studio), the post being replied to
-- {tweetId,url,authorHandle,text}. NULL for normal post sessions.
ALTER TABLE compose_history ADD COLUMN IF NOT EXISTS reply_to JSONB;

CREATE TABLE IF NOT EXISTS prompts (
  id          TEXT PRIMARY KEY,
  owner_key   TEXT NOT NULL,
  command     TEXT NOT NULL,
  title       TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS prompts_owner_command_idx ON prompts (owner_key, command);

CREATE TABLE IF NOT EXISTS x_accounts (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  x_user_id         TEXT NOT NULL,
  username          TEXT NOT NULL,
  access_token_enc  TEXT NOT NULL,
  refresh_token_enc TEXT,
  scope             TEXT NOT NULL DEFAULT '',
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Threads (Meta) connection. Mirrors x_accounts, but the long-lived token is
-- self-refreshing so there is no separate refresh token.
CREATE TABLE IF NOT EXISTS threads_accounts (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  threads_user_id   TEXT NOT NULL,
  username          TEXT NOT NULL,
  access_token_enc  TEXT NOT NULL,
  scope             TEXT NOT NULL DEFAULT '',
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
      // Serverless tuning: many instances each keep a SMALL pool behind Neon's
      // PgBouncer, so cap connections low and recycle idle ones fast. Fail a stuck
      // connection attempt in 10s instead of hanging the whole request.
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: Number(process.env.PG_IDLE_MS || 10_000),
      connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 10_000),
    })
  }
  return pool
}

let schemaReady: Promise<void> | null = null

// A fixed key for the Postgres advisory lock that serializes schema sync.
const SCHEMA_LOCK_KEY = 0x0_017_10ad

/**
 * Sync the schema, at most once per instance. Set DB_SKIP_SCHEMA=1 once the schema
 * is applied in prod to take this off the hot path entirely (no DDL on cold start).
 * When it does run, a session-level advisory lock serializes it so a burst of cold
 * starts can't fire dozens of concurrent ALTERs that contend on table locks.
 */
export function ensureSchema(): Promise<void> {
  if (process.env.DB_SKIP_SCHEMA === '1') return Promise.resolve()
  if (!schemaReady) {
    schemaReady = syncSchema().catch((err) => {
      // Reset so a later request can retry after a transient failure.
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

async function syncSchema(): Promise<void> {
  const client = await getPool().connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_KEY])
    await client.query(SCHEMA_SQL)
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_KEY]).catch(() => {})
    client.release()
  }
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
