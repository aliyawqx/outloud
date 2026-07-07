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
-- Launch attribution (e.g. ?ref=ph from Product Hunt): captured client-side into
-- the signup_ref cookie on first landing, attached to the user at signup. Nullable.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ref TEXT;

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

-- Canonical billing fields (billing spec §7). plan_status:
-- 'trialing'|'active'|'past_due'|'canceled'|'expired'. billing_interval:
-- 'monthly'|'annual'|NULL. credits_allotment = the plan's monthly grant.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_interval TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_allotment INTEGER;

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
