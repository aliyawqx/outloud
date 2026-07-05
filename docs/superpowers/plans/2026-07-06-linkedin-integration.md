# LinkedIn Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `"linkedin"` a real, publishable platform in the scheduler: OAuth connect (3-legged, `w_member_social`), person-URN caching, a publish call the cron can fire (Posts API with UGC fallback), token-expiry/reconnect handling, and 429 backoff-requeue.

**Architecture:** A new `lib/linkedin/` module mirrors the existing per-provider layout. The OAuth control flow mirrors **Threads** (no PKCE — secret-based token exchange, state in a signed cookie); the DB/token storage shape mirrors **X** (nullable `refresh_token_enc`, rotation-safe refresh under a `FOR UPDATE` row lock), plus a `status` column (`connected | needs_reconnect`) that LinkedIn's 60-day-token/no-guaranteed-refresh reality requires. The scheduler side widens `SchedulePlatform`, adds a `publishToLinkedIn` branch to the existing executor, and extends the retry policy with a rate-limit **defer** (requeue +60 min without burning retries).

**Tech Stack:** Next.js 15 route handlers, node-postgres, AES-256-GCM token crypto (per-provider key), jose-signed OAuth-state cookie, LinkedIn REST (`/rest/posts` versioned + `/v2/ugcPosts` fallback, `/v2/userinfo`).

## Global Constraints

- **Personal-profile posting only** — `w_member_social` on Default Tier. NO org/company-page posting (wrong tier, will 403).
- Scopes requested: exactly `openid profile email w_member_social`.
- Token exchange server-side only; client secret never reaches the browser. Tokens encrypted AES-256-GCM with a NEW key `LINKEDIN_TOKEN_ENC_KEY` (per-provider keys rotate independently — existing convention).
- `LINKEDIN_API_VERSION` (`YYYYMM`) centralized in ONE config function with a pinned default `'202506'` — the monthly bump must be a one-line change.
- Env: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `LINKEDIN_API_VERSION` (optional), `LINKEDIN_TOKEN_ENC_KEY`. Config getter must `.trim()` values (a trailing `\n` broke X OAuth once — recorded gotcha).
- Refresh tokens are **optional** (Default tier usually gets none): if present → refresh before expiry (7-day skew); if absent → the only recovery is re-auth. Publish 401 → `status='needs_reconnect'` + notification; publish cron must NOT burn retries on a dead token (terminal error `linkedin_needs_reconnect`).
- 429 → back off and requeue for a later cron cycle (defer +60 min, retryCount NOT incremented), never mark failed for rate limiting.
- `first_reply` / link-in-first-reply is an X-only pattern — do NOT replicate on LinkedIn; links go in the body.
- Voice spec still applies to LinkedIn autopilot content (validator unchanged, ≤280 chars fits LinkedIn's 3000 limit).
- Repo conventions (unchanged from the scheduler plan): TEXT ids/`randomUUID()`, TIMESTAMPTZ, statuses as TEXT with SQL comments, DDL appended to `SCHEMA_SQL` in `lib/db.ts` + mirrored in `db/schema.sql` + applied via `npx tsx scripts/sync-schema.ts` (`DB_SKIP_SCHEMA=1` is set!), `await ensureSchema()` first in every store fn, parameterized SQL, no zod, `getSession()` → 401, commit messages English ≤5 words, `npx tsc --noEmit && npm test` before each commit.
- UI: `electric-indigo`/`cyber-lime` tokens, Material Symbols icons, hand-rolled `rounded-full` buttons, short lowercase-friendly copy. Mirror `components/app/XConnection.tsx` for the connect card.
- **Mirror-the-template rule:** where this plan says "mirror `lib/threads/X`" the implementer must READ that file first and match its exact export names/shape; the code in this plan is the target content, but if the template's helper names differ slightly (e.g. `safeReturnTo` location), follow the template.

## Prerequisites (USER actions — verify before Task 4's live test)

1. In the LinkedIn app (id 260551255), Auth tab: register redirect URLs `https://<prod-domain>/api/linkedin/callback` AND `http://localhost:3000/api/linkedin/callback` (dev).
2. Add to `.env.local` (and later Vercel): `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI=http://localhost:3000/api/linkedin/callback`, and `LINKEDIN_TOKEN_ENC_KEY=$(openssl rand -base64 32)`.
3. Confirm the app has the **Share on LinkedIn** product (grants `w_member_social`) and **Sign In with LinkedIn using OpenID Connect** (grants `openid profile email`).

Tasks 1–3 and 5–8 need no live creds; Task 4's callback smoke and Task 9's live publish do.

## Decisions locked

- No dedicated refresh cron: refresh is lazy at use-time (`getValidAccessToken`, 7-day skew) — every scheduled publish exercises it; plus a proactive "expires soon" UI nudge when no refresh token exists. Rationale: Default tier usually issues no refresh token at all, so a refresh job would mostly be dead code; the reconnect UX is the real path.
- Endpoint probe cache: module-level (`let postsApiWorks: boolean | null`) per serverless instance + `LINKEDIN_FORCE_UGC=1` env override for stickiness across instances once the tier's behavior is known.
- `person_urn` is `NOT NULL` in the new table and cached at connect (spec §3) — the "missing urn" edge (§9) can't occur for rows this code creates; `userinfo` failure at connect aborts with the error redirect.
- Commentary escaping: `/rest/posts` `commentary` is LinkedIn "little text" — reserved chars `\ | { } @ [ ] ( ) < > * _ ~` must be backslash-escaped or posts with parens/brackets get mangled/rejected. A pure `escapeLittleText()` with tests handles this; the `/v2/ugcPosts` fallback takes plain text (no escaping).

---

### Task 1: Schema + env plumbing

**Files:**
- Modify: `lib/db.ts` (append to `SCHEMA_SQL`, after the `notifications` block)
- Modify: `db/schema.sql` (mirror at the end)
- Modify: `.env.example` (add the LinkedIn block)

**Interfaces:**
- Produces: `linkedin_accounts` table (columns below — Task 3's store depends on the exact names).

- [ ] **Step 1: Append DDL to `SCHEMA_SQL` in `lib/db.ts`** (and mirror byte-identically in `db/schema.sql`)

```sql
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
```

- [ ] **Step 2: Add to `.env.example`** (after the Threads block, matching its comment style)

```bash
# LinkedIn OAuth (Share on LinkedIn, Default Tier — personal profile posting only).
# Redirect URI must EXACTLY match one registered on the app's Auth tab.
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/linkedin/callback
# Versioned Posts API month (YYYYMM). Bump ~yearly; one line, see lib/linkedin/config.ts.
LINKEDIN_API_VERSION=202506
# base64, exactly 32 bytes: openssl rand -base64 32
LINKEDIN_TOKEN_ENC_KEY=
# Set to 1 to skip the /rest/posts probe and always use /v2/ugcPosts.
LINKEDIN_FORCE_UGC=
```

- [ ] **Step 3: Apply + verify**

Run: `npx tsc --noEmit`, then `npx tsx scripts/sync-schema.ts` (expected `schema synced`), then verify the table exists via a tsx one-liner (`select table_name from information_schema.tables where table_name='linkedin_accounts'`).

- [ ] **Step 4: Commit**

```bash
git add lib/db.ts db/schema.sql .env.example
git commit -m "Add linkedin accounts schema"
```

---

### Task 2: LinkedIn core lib — config, crypto, errors, oauth, state cookie

**Files:**
- Create: `lib/linkedin/config.ts`
- Create: `lib/linkedin/crypto.ts`
- Create: `lib/linkedin/errors.ts`
- Create: `lib/linkedin/oauth.ts`
- Create: `lib/linkedin/stateCookie.ts`
- Test: `lib/linkedin/oauth.test.ts` (pure `buildAuthUrl` only)

**Interfaces:**
- Consumes: templates `lib/x/config.ts`, `lib/x/crypto.ts`, `lib/threads/oauth.ts`, `lib/threads/stateCookie.ts` (READ them first; mirror shapes).
- Produces:
  - `linkedinConfig(): { clientId: string; clientSecret: string; redirectUri: string }` (throws if unset; `.trim()`s all)
  - `linkedinVersion(): string` (env `LINKEDIN_API_VERSION` or `'202506'`)
  - `encryptToken(plain: string): string`, `decryptToken(payload: string): string` (key `LINKEDIN_TOKEN_ENC_KEY`)
  - errors: `LinkedInNotConnectedError`, `LinkedInAuthError`, `LinkedInPostTooLongError` (`limit: number`), `LinkedInRateLimitError`, `LinkedInVersionError`, `LinkedInPublishError`
  - `LINKEDIN_SCOPES = 'openid profile email w_member_social'`, `makeState(): string`, `buildAuthUrl(p: { clientId: string; redirectUri: string; state: string }): string`, `exchangeCode(p): Promise<TokenResponse>`, `refreshAccessToken(p): Promise<TokenResponse>`, `fetchUserinfo(accessToken: string): Promise<{ sub: string; name: string }>` where `TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number; scope?: string }`
  - `LINKEDIN_OAUTH_COOKIE`, `LINKEDIN_OAUTH_MAX_AGE_S = 600`, `sealOAuthTx({ state, returnTo? })`, `openOAuthTx(token)` (mirror the Threads state-cookie exports exactly — NO PKCE verifier field)

- [ ] **Step 1: `lib/linkedin/config.ts`**

```ts
// LinkedIn app credentials + the pinned Posts API version month.
// .trim() everything — a trailing newline in an env var broke X OAuth once.
const DEFAULT_LINKEDIN_VERSION = '202506'

export function linkedinConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = (process.env.LINKEDIN_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET ?? '').trim()
  const redirectUri = (process.env.LINKEDIN_REDIRECT_URI ?? '').trim()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_REDIRECT_URI are not set')
  }
  return { clientId, clientSecret, redirectUri }
}

/** The LinkedIn-Version header month (YYYYMM). LinkedIn versions monthly and
 *  supports each ~12 months — bumping this is deliberately a one-line change. */
export function linkedinVersion(): string {
  return (process.env.LINKEDIN_API_VERSION ?? '').trim() || DEFAULT_LINKEDIN_VERSION
}
```

- [ ] **Step 2: `lib/linkedin/crypto.ts`** — copy `lib/x/crypto.ts` byte-for-byte, replacing the env var with `LINKEDIN_TOKEN_ENC_KEY` and the header comment noting: "Mirrors lib/x/crypto.ts but uses its own key so the integrations can be rotated independently." (AES-256-GCM, `base64(iv[12]|tag[16]|ciphertext)`, key must decode to exactly 32 bytes.)

- [ ] **Step 3: `lib/linkedin/errors.ts`**

```ts
// Typed publish/auth errors — the scheduler's executor branches on these to
// classify terminal vs transient failures (mirrors lib/x/errors.ts).

export class LinkedInNotConnectedError extends Error {
  constructor(message = 'LinkedIn is not connected.') {
    super(message)
    this.name = 'LinkedInNotConnectedError'
  }
}

/** Dead/invalid token or missing w_member_social — recovery is re-auth. */
export class LinkedInAuthError extends Error {
  constructor(message = 'LinkedIn auth failed.') {
    super(message)
    this.name = 'LinkedInAuthError'
  }
}

export class LinkedInPostTooLongError extends Error {
  limit: number
  constructor(limit: number) {
    super(`LinkedIn posts are limited to ${limit} characters.`)
    this.name = 'LinkedInPostTooLongError'
    this.limit = limit
  }
}

/** ~100 posting calls/day per member — back off and requeue, never fail (spec §6). */
export class LinkedInRateLimitError extends Error {
  constructor(message = 'LinkedIn rate limit reached.') {
    super(message)
    this.name = 'LinkedInRateLimitError'
  }
}

/** The pinned LinkedIn-Version month was rejected — bump LINKEDIN_API_VERSION. */
export class LinkedInVersionError extends Error {
  constructor(message = 'LinkedIn API version rejected — bump LINKEDIN_API_VERSION (lib/linkedin/config.ts).') {
    super(message)
    this.name = 'LinkedInVersionError'
  }
}

export class LinkedInPublishError extends Error {
  constructor(message = 'LinkedIn rejected the post.') {
    super(message)
    this.name = 'LinkedInPublishError'
  }
}
```

- [ ] **Step 4: Write the failing test** — `lib/linkedin/oauth.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { buildAuthUrl, LINKEDIN_SCOPES } from './oauth'

describe('buildAuthUrl', () => {
  it('builds the 3-legged authorization URL per spec §2', () => {
    const url = new URL(
      buildAuthUrl({ clientId: 'cid', redirectUri: 'http://localhost:3000/api/linkedin/callback', state: 'st4te' }),
    )
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/linkedin/callback')
    expect(url.searchParams.get('state')).toBe('st4te')
    expect(url.searchParams.get('scope')).toBe(LINKEDIN_SCOPES)
  })
})
```

Run: `npx vitest run lib/linkedin/oauth.test.ts` — expected FAIL (module missing).

- [ ] **Step 5: `lib/linkedin/oauth.ts`**

```ts
import { randomBytes } from 'node:crypto'
import { LinkedInAuthError } from './errors'

// 3-legged OAuth (spec §2). No PKCE — LinkedIn authenticates the exchange with
// the client secret (server-side only), like the Threads flow. The token
// response MAY include a refresh_token (approved-partner feature) — never
// assume it's present (spec §5).

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'

export const LINKEDIN_SCOPES = 'openid profile email w_member_social'

export type TokenResponse = {
  access_token: string
  expires_in: number // ~5_184_000s = 60 days
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
}

export function makeState(): string {
  return randomBytes(16).toString('base64url')
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', p.clientId)
  url.searchParams.set('redirect_uri', p.redirectUri)
  url.searchParams.set('state', p.state)
  url.searchParams.set('scope', LINKEDIN_SCOPES)
  return url.toString()
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[linkedin/oauth] token request failed: %d %s', res.status, text.slice(0, 300))
    throw new LinkedInAuthError()
  }
  return (await res.json()) as TokenResponse
}

export async function exchangeCode(p: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: p.code,
      redirect_uri: p.redirectUri,
      client_id: p.clientId,
      client_secret: p.clientSecret,
    }),
  )
}

export async function refreshAccessToken(p: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: p.refreshToken,
      client_id: p.clientId,
      client_secret: p.clientSecret,
    }),
  )
}

/** OpenID userinfo — the `sub` field is the member id; the post author is
 *  `urn:li:person:{sub}`. Fetched ONCE at connect time and cached (spec §3). */
export async function fetchUserinfo(accessToken: string): Promise<{ sub: string; name: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[linkedin/oauth] userinfo failed: %d %s', res.status, text.slice(0, 300))
    throw new LinkedInAuthError()
  }
  const data = (await res.json()) as { sub?: string; name?: string }
  if (!data.sub) throw new LinkedInAuthError()
  return { sub: data.sub, name: data.name ?? '' }
}
```

- [ ] **Step 6: `lib/linkedin/stateCookie.ts`** — READ `lib/threads/stateCookie.ts` first and copy its structure exactly (jose HS256 over `AUTH_SECRET`, seal/open pair), renaming: cookie `linkedin_oauth_tx`, exports `LINKEDIN_OAUTH_COOKIE`, `LINKEDIN_OAUTH_MAX_AGE_S = 600`, tx payload `{ state: string; returnTo?: string }` (no PKCE verifier). If the Threads file exposes a `safeReturnTo` helper, reuse/import the same one the Threads callback uses rather than duplicating.

- [ ] **Step 7: Run tests + typecheck, commit**

Run: `npx vitest run lib/linkedin/oauth.test.ts` (PASS), `npx tsc --noEmit && npm test`.

```bash
git add lib/linkedin
git commit -m "Add linkedin oauth core"
```

---

### Task 3: LinkedIn account store

**Files:**
- Create: `lib/linkedin/store.ts`

**Interfaces:**
- Consumes: Task 1 table, Task 2 crypto/oauth/config/errors; `ensureSchema`/`getPool`.
- Produces (Tasks 4–8 rely on these exact names):
  - `type LinkedInAccount = { userId: string; linkedinMemberId: string; personUrn: string; displayName: string; scope: string; status: 'connected' | 'needs_reconnect'; expiresAt: Date; hasRefreshToken: boolean }`
  - `saveAccount(i: SaveAccountInput): Promise<void>` where `SaveAccountInput = { userId: string; linkedinMemberId: string; personUrn: string; displayName: string; accessToken: string; refreshToken?: string; refreshTokenExpiresAt?: Date | null; scope: string; expiresAt: Date }` (resets `status='connected'`)
  - `getAccount(userId: string): Promise<LinkedInAccount | null>`
  - `deleteAccount(userId: string): Promise<boolean>`
  - `markNeedsReconnect(userId: string): Promise<void>`
  - `getValidAccessToken(userId: string): Promise<string>` — throws `LinkedInNotConnectedError` / `LinkedInAuthError`
  - `isExpiring(expiresAt: Date, now: Date): boolean` (7-day skew)

- [ ] **Step 1: `lib/linkedin/store.ts`**

```ts
import { ensureSchema, getPool } from '@/lib/db'
import { linkedinConfig } from './config'
import { decryptToken, encryptToken } from './crypto'
import { LinkedInAuthError, LinkedInNotConnectedError } from './errors'
import { refreshAccessToken } from './oauth'

// Storage/refresh mirrors lib/x/store.ts (nullable refresh token, FOR UPDATE
// serialized refresh) with Threads' long skew: the token lives ~60 days, so we
// refresh a week early. If there is NO refresh token (Default tier norm), an
// expiring/dead token flips status to 'needs_reconnect' — re-auth is the only
// recovery (spec §5).

const REFRESH_SKEW_MS = 7 * 86_400_000

export function isExpiring(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_SKEW_MS
}

export type LinkedInAccount = {
  userId: string
  linkedinMemberId: string
  personUrn: string
  displayName: string
  scope: string
  status: 'connected' | 'needs_reconnect'
  expiresAt: Date
  hasRefreshToken: boolean
}

export type SaveAccountInput = {
  userId: string
  linkedinMemberId: string
  personUrn: string
  displayName: string
  accessToken: string
  refreshToken?: string
  refreshTokenExpiresAt?: Date | null
  scope: string
  expiresAt: Date
}

export async function saveAccount(i: SaveAccountInput): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `INSERT INTO linkedin_accounts
       (user_id, linkedin_member_id, person_urn, display_name, access_token_enc,
        refresh_token_enc, scope, status, expires_at, refresh_token_expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'connected',$8,$9)
     ON CONFLICT (user_id) DO UPDATE SET
       linkedin_member_id = EXCLUDED.linkedin_member_id,
       person_urn = EXCLUDED.person_urn,
       display_name = EXCLUDED.display_name,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       scope = EXCLUDED.scope,
       status = 'connected',
       expires_at = EXCLUDED.expires_at,
       refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
       updated_at = now()`,
    [
      i.userId,
      i.linkedinMemberId,
      i.personUrn,
      i.displayName,
      encryptToken(i.accessToken),
      i.refreshToken ? encryptToken(i.refreshToken) : null,
      i.scope,
      i.expiresAt,
      i.refreshTokenExpiresAt ?? null,
    ],
  )
}

type Row = {
  user_id: string
  linkedin_member_id: string
  person_urn: string
  display_name: string
  access_token_enc: string
  refresh_token_enc: string | null
  scope: string
  status: 'connected' | 'needs_reconnect'
  expires_at: Date
  refresh_token_expires_at: Date | null
}

export async function getAccount(userId: string): Promise<LinkedInAccount | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(`SELECT * FROM linkedin_accounts WHERE user_id = $1`, [userId])
  const row = r.rows[0]
  if (!row) return null
  return {
    userId: row.user_id,
    linkedinMemberId: row.linkedin_member_id,
    personUrn: row.person_urn,
    displayName: row.display_name,
    scope: row.scope,
    status: row.status,
    expiresAt: row.expires_at,
    hasRefreshToken: Boolean(row.refresh_token_enc),
  }
}

export async function deleteAccount(userId: string): Promise<boolean> {
  await ensureSchema()
  const r = await getPool().query(`DELETE FROM linkedin_accounts WHERE user_id = $1`, [userId])
  return (r.rowCount ?? 0) > 0
}

/** Publish 401 / failed refresh → the connection is dead until re-auth (spec §5). */
export async function markNeedsReconnect(userId: string): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE linkedin_accounts SET status = 'needs_reconnect', updated_at = now() WHERE user_id = $1`,
    [userId],
  )
}

/**
 * Valid access token for API calls, refreshing under a row lock when possible.
 * FOR UPDATE serializes concurrent refreshes (publish cron + manual publish)
 * so a rotated refresh token is never lost — same pattern as lib/x/store.ts.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const r = await client.query<Row>(`SELECT * FROM linkedin_accounts WHERE user_id = $1 FOR UPDATE`, [userId])
    const row = r.rows[0]
    if (!row) {
      await client.query('ROLLBACK')
      throw new LinkedInNotConnectedError()
    }
    const now = new Date()
    if (!isExpiring(row.expires_at, now)) {
      await client.query('COMMIT')
      return decryptToken(row.access_token_enc)
    }
    const refreshUsable =
      row.refresh_token_enc && (!row.refresh_token_expires_at || row.refresh_token_expires_at > now)
    if (!refreshUsable) {
      // No (usable) refresh token — mark dead in the same transaction, then re-auth.
      await client.query(
        `UPDATE linkedin_accounts SET status = 'needs_reconnect', updated_at = now() WHERE user_id = $1`,
        [userId],
      )
      await client.query('COMMIT')
      throw new LinkedInAuthError()
    }
    const { clientId, clientSecret } = linkedinConfig()
    const tok = await refreshAccessToken({
      refreshToken: decryptToken(row.refresh_token_enc as string),
      clientId,
      clientSecret,
    })
    await client.query(
      `UPDATE linkedin_accounts SET
         access_token_enc = $2,
         refresh_token_enc = $3,
         expires_at = $4,
         refresh_token_expires_at = $5,
         status = 'connected',
         updated_at = now()
       WHERE user_id = $1`,
      [
        userId,
        encryptToken(tok.access_token),
        tok.refresh_token ? encryptToken(tok.refresh_token) : row.refresh_token_enc, // rotation-safe
        new Date(Date.now() + tok.expires_in * 1000),
        tok.refresh_token_expires_in ? new Date(Date.now() + tok.refresh_token_expires_in * 1000) : row.refresh_token_expires_at,
      ],
    )
    await client.query('COMMIT')
    return tok.access_token
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err instanceof LinkedInAuthError) {
      // Refresh call itself failed → dead connection.
      await markNeedsReconnect(userId).catch(() => {})
    }
    throw err
  } finally {
    client.release()
  }
}
```

> NOTE: the ROLLBACK in the catch is safe after a COMMIT-then-throw (`ROLLBACK` outside a txn is a no-op warning). The no-refresh path COMMITs the `needs_reconnect` write BEFORE throwing so it isn't rolled back.

- [ ] **Step 2: Typecheck + full suite, commit**

Run: `npx tsc --noEmit && npm test`.

```bash
git add lib/linkedin/store.ts
git commit -m "Add linkedin account store"
```

### Task 4: OAuth routes + connection UI

**Files:**
- Create: `app/api/linkedin/connect/route.ts`
- Create: `app/api/linkedin/callback/route.ts`
- Create: `app/api/linkedin/status/route.ts`
- Create: `app/api/linkedin/disconnect/route.ts`
- Create: `components/app/LinkedInConnection.tsx`
- Modify: `app/app/profile/page.tsx` (add `linkedin` searchParam + render the component)

**Interfaces:**
- Consumes: Task 2 oauth/stateCookie/config, Task 3 store; templates `app/api/threads/{connect,callback,status,disconnect}/route.ts` and `components/app/ThreadsConnection.tsx` (READ them first; mirror their exact control flow, cookie handling, and redirect/query-param contract).
- Produces: `GET /api/linkedin/connect` (redirect to LinkedIn), `GET /api/linkedin/callback` (`?linkedin=connected` | `?linkedin=error&lir=denied|state|auth`), `GET /api/linkedin/status` → `{ connected, name, status, expiresAt, hasRefreshToken }`, `POST /api/linkedin/disconnect` → `{ ok: true }`.

- [ ] **Step 1: `app/api/linkedin/connect/route.ts`** — mirror the Threads connect route:

```ts
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { linkedinConfig } from '@/lib/linkedin/config'
import { buildAuthUrl, makeState } from '@/lib/linkedin/oauth'
import { LINKEDIN_OAUTH_COOKIE, LINKEDIN_OAUTH_MAX_AGE_S, sealOAuthTx } from '@/lib/linkedin/stateCookie'

// GET /api/linkedin/connect — start the 3-legged OAuth round-trip. State is
// kept in a SIGNED httpOnly cookie (CSRF); no PKCE — LinkedIn authenticates
// the exchange with the client secret, server-side only.
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { clientId, redirectUri } = linkedinConfig()
  const state = makeState()
  const returnTo = new URL(req.url).searchParams.get('returnTo') ?? undefined

  const res = NextResponse.redirect(buildAuthUrl({ clientId, redirectUri, state }))
  res.cookies.set(LINKEDIN_OAUTH_COOKIE, await sealOAuthTx({ state, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LINKEDIN_OAUTH_MAX_AGE_S,
  })
  return res
}
```

(If the Threads template validates `returnTo` via a `safeReturnTo` helper, use the same helper here.)

- [ ] **Step 2: `app/api/linkedin/callback/route.ts`** — mirror the Threads callback flow:

```ts
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { linkedinConfig } from '@/lib/linkedin/config'
import { exchangeCode, fetchUserinfo } from '@/lib/linkedin/oauth'
import { saveAccount } from '@/lib/linkedin/store'
import { LINKEDIN_OAUTH_COOKIE, openOAuthTx } from '@/lib/linkedin/stateCookie'

// GET /api/linkedin/callback — exchange the code, fetch userinfo (person URN,
// spec §3), persist the connection. Lands back on the profile page with
// ?linkedin=connected | ?linkedin=error&lir=denied|state|auth.
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) redirect('/login')

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const providerError = url.searchParams.get('error')
  const txToken = req.headers.get('cookie')?.match(/linkedin_oauth_tx=([^;]+)/)?.[1]
  const tx = await openOAuthTx(txToken)

  const back = new URL(tx?.returnTo ?? '/app/profile', req.url)

  const fail = (reason: 'denied' | 'state' | 'auth') => {
    back.searchParams.set('linkedin', 'error')
    back.searchParams.set('lir', reason)
    const res = NextResponse.redirect(back)
    res.cookies.delete(LINKEDIN_OAUTH_COOKIE)
    return res
  }

  if (providerError) return fail('denied')
  if (!code || !state || !tx || tx.state !== state) return fail('state')

  try {
    const { clientId, clientSecret, redirectUri } = linkedinConfig()
    const tok = await exchangeCode({ code, clientId, clientSecret, redirectUri })
    // Fetch the member id ONCE at connect time; the post author is this URN (spec §3).
    const { sub, name } = await fetchUserinfo(tok.access_token)
    await saveAccount({
      userId: session.userId,
      linkedinMemberId: sub,
      personUrn: `urn:li:person:${sub}`,
      displayName: name,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token, // may be absent on Default tier — nullable (spec §5)
      refreshTokenExpiresAt: tok.refresh_token_expires_in
        ? new Date(Date.now() + tok.refresh_token_expires_in * 1000)
        : null,
      scope: tok.scope ?? '',
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    })
    back.searchParams.set('linkedin', 'connected')
    const res = NextResponse.redirect(back)
    res.cookies.delete(LINKEDIN_OAUTH_COOKIE)
    return res
  } catch (err) {
    console.error('[linkedin/callback] failed:', err)
    return fail('auth')
  }
}
```

(Match the Threads callback's actual cookie-read idiom — if it uses `req.cookies`/`cookies()` instead of regex, do the same.)

- [ ] **Step 3: `app/api/linkedin/status/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount } from '@/lib/linkedin/store'

// GET /api/linkedin/status — connection state incl. reconnect/expiry info for
// the proactive nudge (spec §5).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const account = await getAccount(session.userId)
  if (!account) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    name: account.displayName,
    status: account.status,
    expiresAt: account.expiresAt.toISOString(),
    hasRefreshToken: account.hasRefreshToken,
  })
}
```

- [ ] **Step 4: `app/api/linkedin/disconnect/route.ts`** — mirror the Threads disconnect (session → `deleteAccount(session.userId)` → `{ ok: true }`).

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { deleteAccount } from '@/lib/linkedin/store'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  await deleteAccount(session.userId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: `components/app/LinkedInConnection.tsx`** — copy `components/app/ThreadsConnection.tsx` structure exactly (status fetch → connect `<a href="/api/linkedin/connect">` → disconnect POST → flash line), adapting label "LinkedIn", endpoints `/api/linkedin/*`, and TWO extra states driven by the status payload:
  - `status === 'needs_reconnect'` → amber line "connection expired — reconnect to keep posting" + the connect link relabeled "Reconnect LinkedIn".
  - `connected && !hasRefreshToken && expiresAt` within 7 days → subtle line "expires soon — reconnect to avoid a gap" (proactive nudge, spec §5).

- [ ] **Step 6: Wire into `app/app/profile/page.tsx`** — extend the `searchParams` type with `linkedin?: string`, compute `linkedinFlash` exactly like the existing `x`/`threads` flashes, render `<LinkedInConnection flash={linkedinFlash} />` after `<ThreadsConnection />`.

- [ ] **Step 7: Verify + commit**

`npx tsc --noEmit && npm test && npm run build`. If `LINKEDIN_*` env creds are present in `.env.local`: dev server + browser-less checks — `curl -sI localhost:3000/api/linkedin/connect -H "Cookie: $COOKIE"` → 307 redirect to `linkedin.com/oauth/v2/authorization` with the right params; `/api/linkedin/status` → `{ connected: false }`. (The full round-trip needs a human browser login — deferred to Task 9.)

```bash
git add app/api/linkedin components/app/LinkedInConnection.tsx app/app/profile/page.tsx
git commit -m "Add linkedin oauth routes"
```

---

### Task 5: Publish client — Posts API + UGC fallback + images + escaping

**Files:**
- Create: `lib/linkedin/client.ts`
- Test: `lib/linkedin/client.test.ts` (pure `escapeLittleText` + `extractPostId`)

**Interfaces:**
- Consumes: Task 2 config/errors.
- Produces:
  - `LINKEDIN_TEXT_LIMIT = 3000`
  - `escapeLittleText(text: string): string` (pure)
  - `extractPostId(headers: Headers): string | null` (pure)
  - `publishLinkedInPost(accessToken: string, personUrn: string, text: string, opts?: { imageUrls?: string[]; imageAlts?: string[] }): Promise<{ id: string; imageSkipped: boolean }>`

- [ ] **Step 1: Write the failing tests** — `lib/linkedin/client.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { escapeLittleText, extractPostId } from './client'

describe('escapeLittleText', () => {
  it('escapes LinkedIn little-text reserved characters', () => {
    expect(escapeLittleText('a (b) {c} [d] @e <f> g|h ~i *j _k \\l')).toBe(
      'a \\(b\\) \\{c\\} \\[d\\] \\@e \\<f\\> g\\|h \\~i \\*j \\_k \\\\l',
    )
  })
  it('leaves plain text untouched', () => {
    expect(escapeLittleText('shipped a tiny fix today and it felt great')).toBe(
      'shipped a tiny fix today and it felt great',
    )
  })
})

describe('extractPostId', () => {
  it('prefers x-restli-id', () => {
    const h = new Headers({ 'x-restli-id': 'urn:li:share:123', 'x-linkedin-id': 'urn:li:share:456' })
    expect(extractPostId(h)).toBe('urn:li:share:123')
  })
  it('falls back to x-linkedin-id, else null', () => {
    expect(extractPostId(new Headers({ 'x-linkedin-id': 'urn:li:share:456' }))).toBe('urn:li:share:456')
    expect(extractPostId(new Headers())).toBeNull()
  })
})
```

Run: `npx vitest run lib/linkedin/client.test.ts` — expected FAIL.

- [ ] **Step 2: Implement `lib/linkedin/client.ts`**

```ts
import { linkedinVersion } from './config'
import {
  LinkedInAuthError,
  LinkedInPostTooLongError,
  LinkedInPublishError,
  LinkedInRateLimitError,
  LinkedInVersionError,
} from './errors'

// Publish path (spec §4). Primary: versioned Posts API (/rest/posts). Fallback:
// legacy /v2/ugcPosts — it's unconfirmed whether bare w_member_social is
// accepted at /rest/posts on Default Tier, so the first publish per instance
// probes and the result is cached (module-level; LINKEDIN_FORCE_UGC=1 pins it).

const POSTS_URL = 'https://api.linkedin.com/rest/posts'
const UGC_URL = 'https://api.linkedin.com/v2/ugcPosts'
const IMAGES_INIT_URL = 'https://api.linkedin.com/rest/images?action=initializeUpload'

export const LINKEDIN_TEXT_LIMIT = 3000

/** null = not probed yet; true = /rest/posts works; false = use /v2/ugcPosts. */
let postsApiWorks: boolean | null = null

/** Posts API `commentary` is LinkedIn "little text": these characters are
 *  markup and must be backslash-escaped or posts with parens/brackets break. */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>*_~]/g, (c) => `\\${c}`)
}

/** The created post id comes back in a response HEADER, not the body (spec §4a). */
export function extractPostId(headers: Headers): string | null {
  return headers.get('x-restli-id') ?? headers.get('x-linkedin-id')
}

function classifyHttpError(status: number, body: string): Error {
  if (status === 401) return new LinkedInAuthError()
  if (status === 403) return new LinkedInAuthError('LinkedIn denied posting permission — reconnect with the posting scope.')
  if (status === 429) return new LinkedInRateLimitError()
  if (status === 426 || (status === 400 && /version/i.test(body))) return new LinkedInVersionError()
  return new LinkedInPublishError(`LinkedIn rejected the post (${status}).`)
}

async function postJson(url: string, accessToken: string, payload: unknown, versioned: boolean): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      ...(versioned ? { 'LinkedIn-Version': linkedinVersion() } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
}

/** Three-step image upload on the Posts API path (spec §4c). Returns the image URN. */
async function uploadImage(accessToken: string, personUrn: string, imageUrl: string): Promise<string> {
  const init = await postJson(IMAGES_INIT_URL, accessToken, { initializeUploadRequest: { owner: personUrn } }, true)
  if (!init.ok) throw classifyHttpError(init.status, await init.text().catch(() => ''))
  const initData = (await init.json()) as { value?: { uploadUrl?: string; image?: string } }
  const uploadUrl = initData.value?.uploadUrl
  const imageUrn = initData.value?.image
  if (!uploadUrl || !imageUrn) throw new LinkedInPublishError('LinkedIn image upload init returned no uploadUrl.')

  const bin = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
  if (!bin.ok) throw new LinkedInPublishError('Could not fetch the image to upload.')
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: Buffer.from(await bin.arrayBuffer()),
    signal: AbortSignal.timeout(30_000),
  })
  if (!put.ok) throw new LinkedInPublishError(`LinkedIn image upload failed (${put.status}).`)
  return imageUrn
}

async function publishViaPostsApi(
  accessToken: string,
  personUrn: string,
  text: string,
  imageUrls: string[],
  imageAlts: string[],
): Promise<{ id: string }> {
  // Text-only is the default path; media only when the post carries it (spec §4c).
  let content: Record<string, unknown> | undefined
  if (imageUrls.length === 1) {
    const id = await uploadImage(accessToken, personUrn, imageUrls[0])
    content = { media: { id, altText: imageAlts[0] ?? '' } }
  } else if (imageUrls.length > 1) {
    const images = []
    for (let i = 0; i < imageUrls.length; i++) {
      images.push({ id: await uploadImage(accessToken, personUrn, imageUrls[i]), altText: imageAlts[i] ?? '' })
    }
    content = { multiImage: { images } }
  }

  const res = await postJson(
    POSTS_URL,
    accessToken,
    {
      author: personUrn,
      commentary: escapeLittleText(text),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
      ...(content ? { content } : {}),
    },
    true,
  )
  if (!res.ok) throw classifyHttpError(res.status, await res.text().catch(() => ''))
  const id = extractPostId(res.headers)
  if (!id) throw new LinkedInPublishError('LinkedIn returned no post id header.')
  return { id }
}

async function publishViaUgc(accessToken: string, personUrn: string, text: string): Promise<{ id: string }> {
  const res = await postJson(
    UGC_URL,
    accessToken,
    {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text }, // plain text — no little-text escaping here
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    false, // Consumer host: no LinkedIn-Version header (spec §4b)
  )
  if (!res.ok) throw classifyHttpError(res.status, await res.text().catch(() => ''))
  const body = (await res.json().catch(() => ({}))) as { id?: string }
  const id = extractPostId(res.headers) ?? body.id
  if (!id) throw new LinkedInPublishError('LinkedIn returned no post id.')
  return { id }
}

/**
 * Publish a text post (+ optional images). Probes /rest/posts once per
 * instance and falls back to /v2/ugcPosts on a permission 403 (spec §4b);
 * the fallback is text-only, so images are skipped there (imageSkipped=true).
 */
export async function publishLinkedInPost(
  accessToken: string,
  personUrn: string,
  text: string,
  opts: { imageUrls?: string[]; imageAlts?: string[] } = {},
): Promise<{ id: string; imageSkipped: boolean }> {
  if (text.length > LINKEDIN_TEXT_LIMIT) throw new LinkedInPostTooLongError(LINKEDIN_TEXT_LIMIT)
  const imageUrls = (opts.imageUrls ?? []).filter(Boolean).slice(0, 9)
  const imageAlts = opts.imageAlts ?? []

  const forceUgc = process.env.LINKEDIN_FORCE_UGC === '1'
  if (!forceUgc && postsApiWorks !== false) {
    try {
      const { id } = await publishViaPostsApi(accessToken, personUrn, text, imageUrls, imageAlts)
      postsApiWorks = true
      return { id, imageSkipped: false }
    } catch (err) {
      // Only a PERMISSION failure demotes the endpoint (Default-tier probe, spec §4b);
      // auth/rate-limit/version errors propagate — falling back wouldn't help.
      if (postsApiWorks === null && err instanceof LinkedInAuthError && /posting permission/.test(err.message)) {
        console.warn('[linkedin] /rest/posts denied for this tier — falling back to /v2/ugcPosts. Set LINKEDIN_FORCE_UGC=1 to pin.')
        postsApiWorks = false
      } else {
        throw err
      }
    }
  }
  const { id } = await publishViaUgc(accessToken, personUrn, text)
  return { id, imageSkipped: imageUrls.length > 0 }
}
```

- [ ] **Step 3: Run tests, typecheck, commit**

`npx vitest run lib/linkedin/client.test.ts` (PASS), `npx tsc --noEmit && npm test`.

```bash
git add lib/linkedin/client.ts lib/linkedin/client.test.ts
git commit -m "Add linkedin publish client"
```

---

### Task 6: Manual publish route + composer destination

**Files:**
- Create: `app/api/linkedin/publish/route.ts`
- Modify: `components/app/ComposeHome.tsx` (Dest union + DESTINATIONS + connected/selected records + prop)
- Modify: `app/app/page.tsx` (load LinkedIn account, pass `linkedInConnected`)

**Interfaces:**
- Consumes: Tasks 3+5; templates `app/api/threads/publish/route.ts`, existing `DraftCard` destination pattern.
- Produces: `POST /api/linkedin/publish` body `{ text, imageUrls?, imageAlts? }` → `{ id, url, imageSkipped }`; 409 `{ error, needsReconnect? }` / 422 tooLong / 429 rateLimited / 502.

- [ ] **Step 1: `app/api/linkedin/publish/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { LINKEDIN_TEXT_LIMIT, publishLinkedInPost } from '@/lib/linkedin/client'
import {
  LinkedInAuthError,
  LinkedInNotConnectedError,
  LinkedInPostTooLongError,
  LinkedInPublishError,
  LinkedInRateLimitError,
  LinkedInVersionError,
} from '@/lib/linkedin/errors'
import { getAccount, getValidAccessToken, markNeedsReconnect } from '@/lib/linkedin/store'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : ''
  if (!text) return NextResponse.json({ error: 'Nothing to publish.' }, { status: 400 })
  if (text.length > LINKEDIN_TEXT_LIMIT) {
    return NextResponse.json(
      { error: `LinkedIn posts are limited to ${LINKEDIN_TEXT_LIMIT} characters. This one is ${text.length}.`, tooLong: true, limit: LINKEDIN_TEXT_LIMIT },
      { status: 422 },
    )
  }
  const imageUrls = Array.isArray((body as { imageUrls?: unknown }).imageUrls)
    ? ((body as { imageUrls: unknown[] }).imageUrls.filter((u): u is string => typeof u === 'string'))
    : []
  const imageAlts = Array.isArray((body as { imageAlts?: unknown }).imageAlts)
    ? ((body as { imageAlts: unknown[] }).imageAlts.filter((a): a is string => typeof a === 'string'))
    : []

  try {
    const token = await getValidAccessToken(session.userId)
    const account = await getAccount(session.userId)
    if (!account) throw new LinkedInNotConnectedError()
    const { id, imageSkipped } = await publishLinkedInPost(token, account.personUrn, text, { imageUrls, imageAlts })
    // No stable public permalink from the API on this tier — link to the feed.
    return NextResponse.json({ id, url: 'https://www.linkedin.com/feed/', imageSkipped })
  } catch (err) {
    if (err instanceof LinkedInNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof LinkedInAuthError) {
      await markNeedsReconnect(session.userId).catch(() => {})
      return NextResponse.json(
        { error: 'Your LinkedIn connection expired. Reconnect your LinkedIn account.', needsReconnect: true },
        { status: 409 },
      )
    }
    if (err instanceof LinkedInPostTooLongError) {
      return NextResponse.json({ error: err.message, tooLong: true, limit: err.limit }, { status: 422 })
    }
    if (err instanceof LinkedInRateLimitError) {
      return NextResponse.json({ error: 'LinkedIn rate limit reached. Try again later.', rateLimited: true }, { status: 429 })
    }
    if (err instanceof LinkedInVersionError) {
      console.error('[linkedin/publish] version rejected — bump LINKEDIN_API_VERSION')
      return NextResponse.json({ error: "Couldn't publish to LinkedIn right now. Please try again." }, { status: 502 })
    }
    if (err instanceof LinkedInPublishError) {
      console.error('[linkedin/publish] LinkedIn rejected the post:', err.message)
      return NextResponse.json({ error: "Couldn't publish to LinkedIn right now. Please try again." }, { status: 502 })
    }
    console.error('[linkedin/publish] failed:', err)
    return NextResponse.json({ error: 'Could not publish to LinkedIn. Try again.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Composer wiring** — in `components/app/ComposeHome.tsx`:
  - `type Dest = 'x' | 'threads' | 'linkedin'`
  - `DESTINATIONS` gains `{ key: 'linkedin', label: 'LinkedIn', endpoint: '/api/linkedin/publish' }`
  - `DraftCard` props gain `linkedInConnected: boolean`; `connected`/initial `selected` records gain `linkedin: linkedInConnected`
  - `ComposeHome` props gain `linkedInConnected = false` and pass it through to every `DraftCard` (find all `<DraftCard` call sites in the file)
  - The "Connect X or Threads in Profile" copy: change to "Connect X, Threads or LinkedIn in Profile to publish." and `noneConnected` to include LinkedIn.
- [ ] **Step 3: `app/app/page.tsx`** — alongside the existing X/Threads account loads, add `getAccount` from `@/lib/linkedin/store` (aliased `getLinkedInAccount`), compute `linkedInConnected = Boolean(li && li.status === 'connected')`, pass into `<ComposeHome linkedInConnected={...}>`.

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit && npm test && npm run build`.

```bash
git add app/api/linkedin/publish components/app/ComposeHome.tsx app/app/page.tsx
git commit -m "Add linkedin manual publish"
```

### Task 7: Scheduler backend integration — platform union, executor branch, 429 defer

**Files:**
- Modify: `lib/schedule/types.ts` (widen the union + label helpers)
- Modify: `lib/schedule/store.ts` (`PublishOutcome.deferMinutes` + `finishPublish`)
- Modify: `lib/schedule/publish.ts` (`publishToLinkedIn`, `rateLimited` flag, defer policy in `decideOutcome`)
- Modify: `lib/autopilot/generate.ts` (`fillSlot` connected-platforms check)
- Test: `lib/schedule/publish.test.ts` (extend — defer policy)

**Interfaces:**
- Consumes: Tasks 3+5 (`getValidAccessToken`/`getAccount`/`markNeedsReconnect` from `@/lib/linkedin/store`, `publishLinkedInPost` + errors), existing executor/types.
- Produces:
  - `SchedulePlatform = 'x' | 'threads' | 'linkedin'`; `SCHEDULE_PLATFORMS` updated; `platformLabel(p): string` ('X'|'Threads'|'LinkedIn') and `platformShort(p): string` ('X'|'Th'|'Li') exported from `lib/schedule/types.ts`
  - `AttemptResult` gains `rateLimited?: boolean`
  - `PublishOutcome` gains `deferMinutes?: number`; `finishPublish` pushes `scheduled_for` forward when set
  - `decideOutcome` policy addition: if there were failures and EVERY failure is rate-limited → `{ status: 'scheduled', retryCount UNCHANGED, deferMinutes: 60 }` (spec §6: back off + requeue, don't burn retries, never fail)
  - new notification kind `'reconnect_needed'` in `lib/notifications/store.ts` `NotificationKind`

- [ ] **Step 1: `lib/schedule/types.ts`** — update the union and add the label helpers (single source for all UI):

```ts
export type SchedulePlatform = 'x' | 'threads' | 'linkedin'
// ...
export const SCHEDULE_PLATFORMS: SchedulePlatform[] = ['x', 'threads', 'linkedin']

export function isSchedulePlatform(v: unknown): v is SchedulePlatform {
  return v === 'x' || v === 'threads' || v === 'linkedin'
}

/** Display names — ONE source so the composer, modals, calendar and settings match. */
export function platformLabel(p: SchedulePlatform): string {
  return p === 'x' ? 'X' : p === 'threads' ? 'Threads' : 'LinkedIn'
}

/** Compact calendar-chip label. */
export function platformShort(p: SchedulePlatform): string {
  return p === 'x' ? 'X' : p === 'threads' ? 'Th' : 'Li'
}
```

- [ ] **Step 2: Write the failing defer-policy tests** — append to `lib/schedule/publish.test.ts`:

```ts
describe('decideOutcome — rate-limit defer (spec §6)', () => {
  const rl = (platform: 'x' | 'threads' | 'linkedin'): AttemptResult => ({
    platform,
    ok: false,
    error: 'rate limit',
    transient: true,
    rateLimited: true,
  })

  it('defers without burning a retry when every failure is rate-limited', () => {
    const o = decideOutcome(2, [rl('linkedin')], { x: '1' }) // retries already exhausted!
    expect(o.status).toBe('scheduled') // still requeued — 429 never fails a post
    expect(o.retryCount).toBe(2) // unchanged
    expect(o.deferMinutes).toBe(60)
    expect(o.externalPostIds).toEqual({ x: '1' })
  })

  it('uses the normal retry path when rate-limit is mixed with another transient failure', () => {
    const o = decideOutcome(0, [rl('linkedin'), fail('threads', '5xx', true)], {})
    expect(o.status).toBe('scheduled')
    expect(o.retryCount).toBe(1) // normal transient retry
    expect(o.deferMinutes).toBeUndefined()
  })

  it('publishes partial success alongside a rate-limited platform only after defer resolves it', () => {
    const o = decideOutcome(0, [ok('x', '1'), rl('linkedin')], {})
    expect(o.status).toBe('scheduled') // keep trying LinkedIn on the deferred pass
    expect(o.externalPostIds).toEqual({ x: '1' })
    expect(o.deferMinutes).toBe(60)
  })
})
```

(Reuse the file's existing `ok`/`fail` helpers; widen `fail`'s platform type to include `'linkedin'`.)
Run: `npx vitest run lib/schedule/publish.test.ts` — the new cases FAIL.

- [ ] **Step 3: `lib/schedule/store.ts`** — extend the outcome type + SQL:

```ts
export type PublishOutcome = {
  status: 'published' | 'scheduled' | 'failed' // 'scheduled' = requeued for retry
  externalPostIds: ExternalPostIds
  error: string | null
  retryCount: number
  /** Rate-limit backoff (spec §6): push scheduled_for forward so the requeue
   *  doesn't hammer the API on the very next cron cycle. */
  deferMinutes?: number
}

export async function finishPublish(id: string, outcome: PublishOutcome): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE scheduled_posts SET
       status = $2,
       external_post_ids = $3,
       error = $4,
       retry_count = $5,
       scheduled_for = CASE WHEN $6::int IS NOT NULL THEN now() + make_interval(mins => $6::int) ELSE scheduled_for END,
       published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
       updated_at = now()
     WHERE id = $1`,
    [id, outcome.status, JSON.stringify(outcome.externalPostIds), outcome.error, outcome.retryCount, outcome.deferMinutes ?? null],
  )
}
```

- [ ] **Step 4: `lib/schedule/publish.ts`** — three changes:

(a) `AttemptResult` gains `rateLimited?: boolean`.

(b) `decideOutcome` — insert the defer branch BEFORE the transient-retry branch:

```ts
  const failures = results.filter((r) => !r.ok)
  const onlyRateLimited = failures.length > 0 && failures.every((r) => r.rateLimited)
  const error = errors.length ? errors.join(' | ') : null
  if (onlyRateLimited) {
    // 429s never fail a post and never burn retries — back off one cycle (spec §6).
    return { status: 'scheduled', externalPostIds: ids, error, retryCount, deferMinutes: 60 }
  }
  if (transient && retryCount < 2) { /* unchanged */ }
```

(c) add `publishToLinkedIn` + wire it into `publishScheduledPost`'s platform loop:

```ts
import { publishLinkedInPost } from '@/lib/linkedin/client'
import {
  LinkedInAuthError,
  LinkedInNotConnectedError,
  LinkedInPostTooLongError,
  LinkedInRateLimitError,
  LinkedInVersionError,
} from '@/lib/linkedin/errors'
import {
  getAccount as getLinkedInAccount,
  getValidAccessToken as getLinkedInToken,
  markNeedsReconnect,
} from '@/lib/linkedin/store'

async function publishToLinkedIn(post: ScheduledPost): Promise<AttemptResult> {
  try {
    const token = await getLinkedInToken(post.userId)
    const account = await getLinkedInAccount(post.userId)
    if (!account) throw new LinkedInNotConnectedError()
    // No first_reply chaining here — link-in-first-reply is an X reach
    // workaround; on LinkedIn links belong in the body (spec §8).
    const urls = (post.media ?? []).map((m) => m.url)
    const alts = (post.media ?? []).map((m) => m.alt ?? '')
    const { id } = await publishLinkedInPost(token, account.personUrn, post.content, { imageUrls: urls, imageAlts: alts })
    return { platform: 'linkedin', ok: true, id }
  } catch (err) {
    if (err instanceof LinkedInNotConnectedError) {
      return { platform: 'linkedin', ok: false, error: 'LinkedIn not connected', transient: false }
    }
    if (err instanceof LinkedInAuthError) {
      // Dead token: flag reconnect + tell the user; NEVER burn retries on it (spec §5).
      await markNeedsReconnect(post.userId).catch(() => {})
      await addNotification({
        userId: post.userId,
        kind: 'reconnect_needed',
        title: 'reconnect linkedin',
        body: 'your linkedin connection expired — reconnect in profile to keep posting.',
        refId: post.id,
      }).catch((e) => console.error('[schedule/publish] notify failed:', e))
      return { platform: 'linkedin', ok: false, error: 'linkedin_needs_reconnect', transient: false }
    }
    if (err instanceof LinkedInPostTooLongError) {
      return { platform: 'linkedin', ok: false, error: `too long for LinkedIn (limit ${err.limit})`, transient: false }
    }
    if (err instanceof LinkedInRateLimitError) {
      return { platform: 'linkedin', ok: false, error: 'LinkedIn rate limit', transient: true, rateLimited: true }
    }
    if (err instanceof LinkedInVersionError) {
      console.error('[schedule/publish] LinkedIn version rejected — bump LINKEDIN_API_VERSION')
      return { platform: 'linkedin', ok: false, error: 'linkedin api version outdated', transient: false }
    }
    console.error('[schedule/publish] LinkedIn failed:', err)
    return { platform: 'linkedin', ok: false, error: 'LinkedIn publish failed', transient: true }
  }
}
```

In `publishScheduledPost`'s loop replace the ternary with an explicit map:

```ts
  for (const platform of post.platforms) {
    if (prior[platform]) continue
    if (platform === 'x') results.push(await publishToX(post))
    else if (platform === 'threads') results.push(await publishToThreads(post))
    else results.push(await publishToLinkedIn(post))
  }
```

- [ ] **Step 5: `lib/notifications/store.ts`** — widen the kind union:

```ts
export type NotificationKind = 'autopilot_queued' | 'autopilot_paused' | 'publish_failed' | 'reconnect_needed'
```

- [ ] **Step 6: `lib/autopilot/generate.ts`** — in `fillSlot`'s connected-platforms block add (import `getAccount as getLinkedInAccount` from `@/lib/linkedin/store`):

```ts
    if (p === 'linkedin') {
      const li = await getLinkedInAccount(user.userId)
      if (li && li.status === 'connected') connected.push('linkedin')
    }
```

- [ ] **Step 7: Run tests (new defer cases PASS, all others still green), typecheck, build; commit**

`npx vitest run lib/schedule/publish.test.ts && npx tsc --noEmit && npm test && npm run build`

```bash
git add lib/schedule lib/notifications/store.ts lib/autopilot/generate.ts
git commit -m "Add linkedin publish branch"
```

---

### Task 8: UI integration — platform pickers, calendar, reconnect banners, bell icon

**Files:**
- Modify: `components/app/ScheduleModal.tsx` (label mapping)
- Modify: `components/app/calendar/CalendarView.tsx` (`PlatformIcons` short labels)
- Modify: `components/app/calendar/PostEditorModal.tsx` (`ALL_PLATFORMS` from the shared list)
- Modify: `components/app/autopilot/AutopilotSettingsPanel.tsx` (LinkedIn toggle + prop)
- Modify: `app/app/autopilot/page.tsx` (LinkedIn account fetch + banner props)
- Modify: `app/app/calendar/page.tsx` + `components/app/calendar/CalendarView.tsx` (needs-reconnect banner)
- Modify: `components/app/NotificationsBell.tsx` (icon for `reconnect_needed`)
- Modify: `components/app/VoiceOnboarding.tsx` (step-4 default platforms)

**Interfaces:**
- Consumes: `platformLabel`/`platformShort`/`SCHEDULE_PLATFORMS` (Task 7), `getAccount` from `@/lib/linkedin/store` (server pages).
- Produces: LinkedIn selectable everywhere platforms appear; a reusable reconnect banner on the calendar + autopilot pages.

- [ ] **Step 1: `components/app/ScheduleModal.tsx`** — replace the inline label ternary with `platformLabel`:

```tsx
import { platformLabel, type SchedulePlatform } from '@/lib/schedule/types'
// ...
          Posting to: {platforms.map((p) => platformLabel(p as SchedulePlatform)).join(' + ')}
```

- [ ] **Step 2: `components/app/calendar/CalendarView.tsx`** — `PlatformIcons` uses `platformShort`:

```tsx
import { platformShort, type SchedulePlatform } from '@/lib/schedule/types'

function PlatformIcons({ platforms }: { platforms: string[] }) {
  return (
    <span className="font-code-label text-[10px] uppercase text-on-surface-variant/70">
      {platforms.map((p) => platformShort(p as SchedulePlatform)).join('·')}
    </span>
  )
}
```

- [ ] **Step 3: `components/app/calendar/PostEditorModal.tsx`** — derive from the shared list:

```tsx
import { platformLabel, SCHEDULE_PLATFORMS, type ScheduledPost, type SchedulePlatform } from '@/lib/schedule/types'

const ALL_PLATFORMS: { key: SchedulePlatform; label: string }[] = SCHEDULE_PLATFORMS.map((p) => ({
  key: p,
  label: platformLabel(p),
}))
```

- [ ] **Step 4: Reconnect banner (shared component)** — create `components/app/LinkedInReconnectBanner.tsx`:

```tsx
import Link from 'next/link'

// Amber "reconnect LinkedIn" strip (spec §5) shown on the calendar and
// autopilot pages when the connection is dead or (no refresh token) expiring.
export function LinkedInReconnectBanner({ expiring = false }: { expiring?: boolean }) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-error/40 bg-error/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-body-sm text-body-sm text-on-surface">
        {expiring
          ? 'your linkedin connection expires soon — reconnect to avoid a posting gap.'
          : 'your linkedin connection expired — scheduled linkedin posts will fail until you reconnect.'}
      </p>
      <Link
        href="/app/profile"
        className="shrink-0 rounded-full bg-electric-indigo px-4 py-2 text-center font-code-label text-code-label font-bold text-white transition-colors hover:bg-primary-container"
      >
        Reconnect LinkedIn
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Wire the banner into the calendar** — `app/app/calendar/page.tsx` becomes async, loads the LinkedIn account and renders the banner above `<CalendarView />`:

```tsx
import { getSession } from '@/lib/auth/session'
import { getAccount as getLinkedInAccount } from '@/lib/linkedin/store'
import { CalendarView } from '@/components/app/calendar/CalendarView'
import { LinkedInReconnectBanner } from '@/components/app/LinkedInReconnectBanner'

export const metadata = { title: 'Calendar — Outloud' }

const EXPIRY_NUDGE_MS = 7 * 86_400_000

export default async function CalendarPage() {
  const session = await getSession()
  const li = session ? await getLinkedInAccount(session.userId) : null
  const needsReconnect = li?.status === 'needs_reconnect'
  const expiring = Boolean(
    li && li.status === 'connected' && !li.hasRefreshToken && li.expiresAt.getTime() - Date.now() < EXPIRY_NUDGE_MS,
  )
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg">Calendar</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Everything queued to publish — your scheduled posts and autopilot&apos;s, side by side.
        </p>
      </div>
      {(needsReconnect || expiring) && <LinkedInReconnectBanner expiring={!needsReconnect && expiring} />}
      <CalendarView />
    </div>
  )
}
```

- [ ] **Step 6: Autopilot page + panel** — `app/app/autopilot/page.tsx`: add the LinkedIn account to the existing `Promise.all` (`getAccount as getLinkedInAccount` from `@/lib/linkedin/store`), compute the same `needsReconnect`/`expiring` flags, render `<LinkedInReconnectBanner />` above the panel under the same condition, and pass `linkedInConnected={Boolean(li && li.status === 'connected')}` into `<AutopilotSettingsPanel>`. In `components/app/autopilot/AutopilotSettingsPanel.tsx`: add `linkedInConnected: boolean` to props, extend `connected` to `Record<SchedulePlatform, boolean>` = `{ x: xConnected, threads: threadsConnected, linkedin: linkedInConnected }`, and change the platforms row to map over `SCHEDULE_PLATFORMS` with `platformLabel(p)` (imports from `@/lib/schedule/types`).

- [ ] **Step 7: `components/app/NotificationsBell.tsx`** — add to `KIND_ICON`:

```ts
  reconnect_needed: 'link_off',
```

(and include `reconnect_needed` in the red-icon condition alongside `publish_failed`).

- [ ] **Step 8: `components/app/VoiceOnboarding.tsx`** — step 4's PUT body: `platforms: ['x', 'threads', 'linkedin']` (the cron intersects with actually-connected accounts, so this stays safe).

- [ ] **Step 9: Verify + commit**

`npx tsc --noEmit && npm test && npm run build`.

```bash
git add components/app app/app/calendar/page.tsx app/app/autopilot/page.tsx
git commit -m "Add linkedin platform UI"
```

---

### Task 9: End-to-end verification (user-assisted)

**Files:** none new — verification, fix-forward with per-fix commits.

- [ ] **Step 1: Full local gate** — `npx tsc --noEmit && npm test && npm run build`.
- [ ] **Step 2 (needs env creds): OAuth redirect shape** — dev server; `curl -sI localhost:3000/api/linkedin/connect -H "Cookie: $COOKIE"` → 307 to `www.linkedin.com/oauth/v2/authorization` with `response_type=code`, correct `client_id`, `redirect_uri`, `state`, `scope=openid profile email w_member_social`; the `linkedin_oauth_tx` cookie is set httpOnly.
- [ ] **Step 3 (HUMAN): live connect** — the owner opens `/app/profile`, clicks Connect LinkedIn, authorizes; expect `?linkedin=connected` flash, a `linkedin_accounts` row with `person_urn='urn:li:person:...'`, `status='connected'`, `expires_at≈now+60d`; note in the report whether a `refresh_token` was issued (Default tier: likely not).
- [ ] **Step 4 (HUMAN-approved): live publish** — schedule a short test post to LinkedIn (+X/Threads if desired) ~1 min out; fire the publish cron; expect `external_post_ids.linkedin` set (URN), post visible on the profile feed (owner deletes it manually afterwards). This also settles the §4b probe: check the logs for whether `/rest/posts` worked or the UGC fallback engaged — record the answer and, if UGC, set `LINKEDIN_FORCE_UGC=1` in env.
- [ ] **Step 5: Reconnect path (safe simulation)** — flip the row: `UPDATE linkedin_accounts SET status='needs_reconnect' WHERE user_id='<owner>'` → calendar + autopilot pages show the banner; composer still lists LinkedIn (connected-at-publish semantics) but a cron publish of a LinkedIn post fails terminally with `linkedin_needs_reconnect` and a `reconnect_needed` notification appears; restore `status='connected'` after.
- [ ] **Step 6: 429 defer (unit-verified)** — already covered by the Task 7 tests; do not attempt to trigger a live 429.
- [ ] **Step 7: Prod rollout notes** — append to `docs/cron-setup.md` env list: the five `LINKEDIN_*` vars; remind: register the prod HTTPS redirect URI; prod schema sync via `scripts/sync-schema.ts` BEFORE deploy. Commit (`Update cron doc for linkedin`).

---

## Self-review (done at plan-writing time)

- **Spec coverage:** §2 OAuth → Tasks 2+4 (authorization URL params exact, form-encoded exchange, optional refresh_token stored nullable, per-user row with status column, tokens encrypted per existing convention); §3 person URN → Task 4 callback (`fetchUserinfo` once, cached NOT NULL); §4a Posts API → Task 5 (headers incl. pinned `LinkedIn-Version` via one config fn, body verbatim, id from response header); §4b UGC fallback → Task 5 (probe on permission-403 once per instance, module cache + `LINKEDIN_FORCE_UGC` pin); §4c images → Task 5 (initializeUpload → PUT → content.media, behind a media branch; UGC fallback skips images with `imageSkipped`); §5 expiry/reconnect → Task 3 (lazy refresh w/ 7-day skew, rotation-safe, needs_reconnect on no-refresh-token or failed refresh), Task 7 (publish 401 → markNeedsReconnect + notification + terminal error, no retries burnt), Task 8 (banners + proactive nudge), no-refresh-cron decision documented; §6 rate limits → Task 7 defer policy (+tests); §7 config/env → Tasks 1–2 (all five vars, secret server-side only); §8 scheduler plug-in → Tasks 7–8 (platforms union, per-platform ids/errors, partial failure preserved, voice spec untouched, first_reply NOT applied to LinkedIn); §9 edge cases → 403-no-scope (classify → LinkedInAuthError → reconnect prompt), person_urn NOT NULL by construction, disconnected-platform skip (existing executor semantics), version rejection → LinkedInVersionError naming the env var; §10 build order preserved; §11 guardrails → Global Constraints.
- **Placeholder scan:** clean — every code step carries full code; "mirror the template" steps name the exact file to read and provide target code.
- **Type consistency:** `SchedulePlatform`/`platformLabel`/`platformShort` (Task 7) consumed in Task 8; `LinkedInAccount.hasRefreshToken`/`status` (Task 3) consumed in Tasks 4/8; `AttemptResult.rateLimited` + `PublishOutcome.deferMinutes` (Task 7) consistent between publish.ts, store.ts and tests; `TokenResponse` fields (Task 2) consumed in Tasks 3–4.
- **Known risks flagged for reviewers:** the little-text escaping set and the `content.multiImage` shape follow LinkedIn's documented Posts API but are the least-verified parts — Task 9's live publish is the arbiter; the UGC fallback keeps text posts working regardless.


