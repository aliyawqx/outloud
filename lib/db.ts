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
-- Launch attribution (e.g. ?ref=ph from Product Hunt): captured client-side into
-- the signup_ref cookie on first landing, attached to the user at signup. Nullable.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ref TEXT;

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

-- Credit system: cached balance on the profile (source of truth), with every
-- change also appended to credit_ledger as an audit trail. Deduction is an atomic
-- conditional UPDATE (balance never goes negative).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0;
-- Purchased top-up credits — a SEPARATE bucket that NEVER expires/resets. Plan
-- credits (credit_balance) reset each cycle; top-ups persist. Spend plan first.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS topup_balance INTEGER NOT NULL DEFAULT 0;
-- When the FREE allowance next auto-resets (lazy, on read). NULL = reset on next read.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;
-- True while a subscription is in its 7-day trial (no top-ups allowed during trial).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trialing BOOLEAN NOT NULL DEFAULT false;
-- True once the customer has ever started a trial — repeat checkouts skip the trial
-- (allow_trial=false), since Polar allows a trial only once per customer.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT false;
-- Polar references (set from the billing webhook): the customer id powers the
-- customer-portal link (payment method, invoices, cancel); subscription id for ops.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;
-- Per-tour onboarding completion, e.g. {"welcome":true,"new_post":true,...}. Each
-- key is one tour; absence/false = not yet shown. Reset keys to replay a tour.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Canonical billing fields (billing spec §7). plan_status:
-- 'trialing'|'active'|'past_due'|'canceled'|'expired'. billing_interval:
-- 'monthly'|'annual'|NULL. credits_allotment = the plan's monthly grant.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_interval TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_allotment INTEGER;

CREATE TABLE IF NOT EXISTS credit_ledger (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  amount       INTEGER NOT NULL,               -- signed delta: grants/purchases +, spends -
  reason       TEXT NOT NULL,                  -- 'grant'|'post'|'reply'|'search'|'purchase'|'reset'
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON credit_ledger (user_id, created_at DESC);
-- Resulting balance after this entry, and the post/reply id it paid for (nullable).
ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS balance_after INTEGER;
ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS ref_id TEXT;

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

-- One shared posting calendar. Manual and autopilot posts live in the SAME table
-- and render on the same calendar. status: 'draft'|'scheduled'|'publishing'|
-- 'published'|'failed'|'cancelled'. source: 'manual'|'autopilot'. Times are UTC;
-- the IANA timezone is kept for display and slot math.
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  first_reply       TEXT,                                -- X link-in-first-reply; NULL for autopilot
  platforms         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- e.g. ["x","threads"]
  media             JSONB,                               -- [{url,alt?}] image refs, nullable
  scheduled_for     TIMESTAMPTZ NOT NULL,
  timezone          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'scheduled',
  source            TEXT NOT NULL DEFAULT 'manual',
  external_post_ids JSONB,                               -- {"x":"...","threads":"..."} after publish
  error             TEXT,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  credits_charged   INTEGER NOT NULL DEFAULT 0,
  charge_ledger_id  TEXT,                                -- credit_ledger id, for refund on cancel
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS scheduled_posts_due_idx ON scheduled_posts (status, scheduled_for);
CREATE INDEX IF NOT EXISTS scheduled_posts_user_idx ON scheduled_posts (user_id, scheduled_for);
-- Two concurrent generation-cron runs must not double-fill the same slot.
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_posts_autopilot_slot_idx
  ON scheduled_posts (user_id, scheduled_for) WHERE source = 'autopilot' AND status = 'scheduled';

-- Autopilot config, one row per user. posting_times: [{"time":"HH:MM","days":[0-6]?}]
-- (days optional = every day; 0=Sunday). pause_reason: e.g. 'insufficient_credits'|'user'.
CREATE TABLE IF NOT EXISTS autopilot_settings (
  user_id               TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled               BOOLEAN NOT NULL DEFAULT false,
  interests             JSONB NOT NULL DEFAULT '[]'::jsonb,
  posting_times         JSONB NOT NULL DEFAULT '[]'::jsonb,
  timezone              TEXT NOT NULL DEFAULT 'UTC',
  platforms             JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_before_publish BOOLEAN NOT NULL DEFAULT false,
  slots_per_day         INTEGER NOT NULL DEFAULT 1,
  lead_time_minutes     INTEGER NOT NULL DEFAULT 240,
  paused_at             TIMESTAMPTZ,
  pause_reason          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zero-touch addendum: review-before-publish is now opt-in (default off).
ALTER TABLE autopilot_settings ALTER COLUMN review_before_publish SET DEFAULT false;
-- Attach an AI-generated image to each autopilot post (costs COST_PER_AI_PHOTO
-- per post on top of the draft; image failures never block the post).
ALTER TABLE autopilot_settings ADD COLUMN IF NOT EXISTS ai_images BOOLEAN NOT NULL DEFAULT false;

-- Live links to published posts, keyed by platform (zero-touch addendum).
-- Only 'published' posts carry these; populated by the publish cron.
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS permalinks JSONB;

-- Lightweight in-app notifications. kind: 'autopilot_queued'|'autopilot_paused'|'publish_failed'.
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  ref_id     TEXT,                                       -- scheduled_posts.id when relevant
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
-- Optional tap-through URL (e.g. the live post) rendered as a link in the bell.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- LinkedIn connection (personal-profile posting, w_member_social, Default Tier).
-- Access token lives ~60 days; refresh_token is OPTIONAL (Default tier usually
-- gets none — recovery is re-auth). status: 'connected'|'needs_reconnect'
-- (set on 401/refresh failure by the publish path; reset on reconnect).
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  linkedin_member_id       TEXT NOT NULL,            -- userinfo.sub
  person_urn               TEXT NOT NULL,            -- "urn:li:person:{sub}", cached at connect (spec §3)
  display_name             TEXT NOT NULL DEFAULT '',
  access_token_enc         TEXT NOT NULL,
  refresh_token_enc        TEXT,
  scope                    TEXT NOT NULL DEFAULT '',
  status                   TEXT NOT NULL DEFAULT 'connected',
  expires_at               TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
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
