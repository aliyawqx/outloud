CREATE TABLE IF NOT EXISTS early_access_signups (
  id SERIAL PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved voice profiles (Voice Inspiration system).
-- owner_key: anonymous client id in Phase 1; real user id once auth lands.
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
