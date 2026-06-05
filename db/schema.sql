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
