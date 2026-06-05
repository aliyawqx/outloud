# X API Integration — Design

Date: 2026-06-05
Status: Approved

## Goal

Add full OAuth 2.0 integration with the official X (Twitter) API so authenticated
Outloud users can, with their own connected X account:

1. **Publish** a generated draft directly to their X account (manual, per-action).
2. **Import** their own recent posts to feed the voice/style-analysis pipeline,
   replacing manual link pasting.

Both run on behalf of the user via OAuth 2.0 (PKCE), scopes
`tweet.read tweet.write users.read offline.access`.

## Scope decisions

- **Both features.** Publishing works on the X API Free tier. Reading a user's own
  timeline (`GET /2/users/:id/tweets`) requires the paid Basic tier (~$100/mo).
  Import is therefore **gracefully gated**: it works once the account has Basic+,
  and otherwise fails with a clear `ImportNotAvailableError` message. Publishing
  is unaffected.
- **One X account per user** (1:1).
- Credentials are **scaffolded** (env placeholders); the operator pastes real keys.

### Out of scope (YAGNI)

Threads / multi-tweet, media/image upload, scheduled posting, multiple X accounts
per user.

## OAuth approach

OAuth 2.0 + PKCE, confidential client (we hold `X_CLIENT_SECRET`). This is the
approach in `xdevplatform/samples`. Rejected: OAuth 1.0a (legacy, complex signing),
app-only Bearer (can't post on behalf of a user, can't read private timeline).

## Components

### 1. Credentials (`.env.example`)

- `X_CLIENT_ID`, `X_CLIENT_SECRET` — from the X Developer Portal
- `X_REDIRECT_URI` — `http://localhost:3000/api/x/callback` (dev) / production URL
- `X_TOKEN_ENC_KEY` — 32-byte base64 key for AES-256-GCM token encryption

### 2. Database — new table `x_accounts`

Added to the inlined `SCHEMA_SQL` in [lib/db.ts](../../../lib/db.ts). 1:1 with
`users`; tokens encrypted at rest.

```sql
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
```

### 3. `lib/x/` module

- `crypto.ts` — encrypt/decrypt tokens (AES-256-GCM, key from `X_TOKEN_ENC_KEY`)
- `oauth.ts` — PKCE (verifier/challenge S256), `buildAuthUrl`, `exchangeCode`,
  `refreshToken`
- `store.ts` — `saveAccount` / `getAccount` / `deleteAccount` (scoped by `user_id`),
  `getValidAccessToken` (auto-refresh when expired)
- `client.ts` — `postTweet(text)`, `fetchRecentTweets(userId)` (filters retweets /
  replies), `getMe()`
- `errors.ts` — `XNotConnectedError`, `XAuthError`, `ImportNotAvailableError`
  (tier/403), `PublishError`

### 4. API routes (`app/api/x/`)

All require an authenticated session; rows scoped by `user_id`.

- `GET /api/x/connect` — generate PKCE verifier + state, store in a signed httpOnly
  cookie, redirect to the X authorize URL
- `GET /api/x/callback` — verify `state`, exchange `code`, call `GET /2/users/me`,
  save the account, redirect back to settings with a success/error flag
- `POST /api/x/disconnect` — delete the connection (best-effort token revoke)
- `GET /api/x/status` — `{ connected, username, scope }` for the UI
- `POST /api/x/publish` — `{ text }` or `{ historyId, draftIndex }` → posts, returns
  the tweet id + URL
- `POST /api/x/import` — `{ profileId }` → fetch recent posts, add as samples
  (`source: 'x'`); tier-gated with a clean `ImportNotAvailableError`

### 5. UI

- **Settings** ([components/app/ProfileForm.tsx](../../../components/app/ProfileForm.tsx)):
  "Connect X" / "Connected as @handle · Disconnect" block (uses `/status`,
  `/connect`, `/disconnect`)
- **Publish** ([components/app/ComposeHome.tsx](../../../components/app/ComposeHome.tsx)):
  "Publish to X" button on each draft → dialog with editable text + char count →
  link to the live tweet. If not connected, prompt to connect.
- **Import** ([components/voice/StylePage.tsx](../../../components/voice/StylePage.tsx)):
  "Import from X" button next to the URL/paste input. Gated-tier → soft message.

### 6. Security

- PKCE (S256) + `state` (CSRF) carried in a signed httpOnly cookie
- Tokens encrypted at rest (AES-256-GCM)
- All routes behind the session; `x_accounts` scoped by `user_id`
- Scopes: `tweet.read tweet.write users.read offline.access`

### 7. Post length

Drafts may exceed 280 characters. We do **not** hard-block: soft-validate
non-empty and a sane upper cap, attempt the post, and surface X's own length error
verbatim (long posts require a premium/verified account on X's side).

## Error handling

Custom errors mapped to clean JSON + status in routes. Token refresh failure →
mark disconnected, ask the user to reconnect. Import 403 (tier) →
`ImportNotAvailableError` with a friendly message.

## Testing (TDD)

- `lib/x/crypto.test.ts` — encrypt/decrypt round-trip
- `lib/x/oauth.test.ts` — PKCE challenge derivation, auth-URL params, token exchange
  (mocked fetch)
- `lib/x/store.test.ts` — save/get + refresh logic (mocked)
- `lib/x/client.test.ts` — `postTweet` length/success, `fetchRecentTweets` filtering
  + 403 → `ImportNotAvailableError`
- Route tests for publish / import / callback (mocked), matching existing
  `app/api/**/route.test.ts` patterns

## X Developer Portal — use-case description (for the application form)

Stored here so it stays in sync with the implementation:

> Outloud is a writing assistant that helps individual creators draft and publish
> posts for their own X account in their personal writing style. We use the X API on
> behalf of authenticated users who explicitly connect their own X account via OAuth
> 2.0 (PKCE), with scopes `tweet.read`, `tweet.write`, `users.read`, `offline.access`.
> (1) Publishing posts (POST /2/tweets), manual per-action only. (2) Reading the
> user's own recent posts (GET /2/users/:id/tweets) and account info (GET /2/users/me)
> to analyze their writing style for generating drafts that sound like them. (3)
> Account identification. We store only OAuth tokens (encrypted at rest, AES-256-GCM)
> and a short style analysis derived from the user's own posts, scoped privately per
> user; disconnect deletes stored tokens. We do not sell or share X data, do not
> display other users' Tweets off-platform, and no government entity is involved.
