CREATE TABLE IF NOT EXISTS early_access_signups (
  id SERIAL PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accounts (custom email+password auth). id is an app-generated uuid.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1:1 profile per user.
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

-- Saved voice profiles (Voice Inspiration system).
-- owner_key holds the authenticated user id.
CREATE TABLE IF NOT EXISTS voice_profiles (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  kind TEXT NOT NULL,                            -- 'own' | 'inspiration'
  name TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{ sourceId, weight }]
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
ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS style_guide TEXT NOT NULL DEFAULT '';
ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'x';

-- Writing samples ingested for own-voice capture.
CREATE TABLE IF NOT EXISTS writing_samples (
  id TEXT PRIMARY KEY,
  voice_profile_id TEXT NOT NULL REFERENCES voice_profiles(id) ON DELETE CASCADE,
  owner_key TEXT NOT NULL,
  source TEXT NOT NULL,                   -- 'x' | 'paste' | 'upload' | 'url'
  text TEXT NOT NULL,
  used_in_style BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS writing_samples_profile_idx ON writing_samples (voice_profile_id);

-- Saved compose sessions (History panel).
CREATE TABLE IF NOT EXISTS compose_history (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  voice_profile_id TEXT,
  voice_name TEXT NOT NULL DEFAULT '',
  idea TEXT NOT NULL,
  drafts JSONB NOT NULL DEFAULT '[]'::jsonb,   -- DraftPost[]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compose_history_owner_idx ON compose_history (owner_key, created_at DESC);

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
  review_before_publish BOOLEAN NOT NULL DEFAULT true,
  slots_per_day         INTEGER NOT NULL DEFAULT 1,
  lead_time_minutes     INTEGER NOT NULL DEFAULT 240,
  paused_at             TIMESTAMPTZ,
  pause_reason          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
