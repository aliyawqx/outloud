# X API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated Outloud user connect their own X account via OAuth 2.0 to publish generated drafts to X and import their own recent posts for voice analysis.

**Architecture:** OAuth 2.0 + PKCE (confidential client) against X API v2. A new `lib/x/` module holds pure, testable units (token crypto, OAuth helpers, API client, owner-scoped token store). Thin Next.js route handlers under `app/api/x/` orchestrate them. UI buttons live in the existing profile, composer, and style pages. Import is gracefully gated: it works on X API Basic+ and otherwise fails with a clear message; publishing works on Free.

**Tech Stack:** Next.js 15 (App Router, route handlers), TypeScript, `pg` (Postgres), `jose` (signed cookies), Node `crypto` (AES-256-GCM, PKCE), Vitest.

---

## File Structure

**New — `lib/x/` (pure, unit-tested):**
- `lib/x/config.ts` — read + validate X OAuth env vars
- `lib/x/errors.ts` — `XNotConnectedError`, `XAuthError`, `ImportNotAvailableError`, `PublishError`
- `lib/x/crypto.ts` — `encryptToken` / `decryptToken` (AES-256-GCM)
- `lib/x/oauth.ts` — PKCE + auth URL + token exchange/refresh
- `lib/x/stateCookie.ts` — seal/open the PKCE+state transaction in a signed cookie
- `lib/x/store.ts` — `saveAccount` / `getAccount` / `deleteAccount` / `getValidAccessToken` (+ `isExpiring`)
- `lib/x/client.ts` — `getMe` / `postTweet` / `fetchOriginalTweets`

**New — routes (`app/api/x/`):**
- `connect/route.ts` (GET), `callback/route.ts` (GET), `status/route.ts` (GET),
  `disconnect/route.ts` (POST), `publish/route.ts` (POST), `import/route.ts` (POST)

**New — UI:**
- `components/app/XConnection.tsx` — connect/disconnect block (in profile page)

**Modified:**
- `lib/db.ts` — add `x_accounts` table to `SCHEMA_SQL`
- `app/app/profile/page.tsx` — render `<XConnection>` + read `?x=` flash
- `components/app/ComposeHome.tsx` — "Publish to X" on each draft
- `components/voice/StylePage.tsx` — "Import from X" action
- `.env.example` — X OAuth env placeholders

**Shared interfaces (defined once, used across tasks):**

```ts
// lib/x/oauth.ts
export type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

// lib/x/store.ts
export type XAccount = {
  userId: string
  xUserId: string
  username: string
  scope: string
  expiresAt: string // ISO
}
export type SaveAccountInput = {
  userId: string
  xUserId: string
  username: string
  accessToken: string
  refreshToken?: string
  scope: string
  expiresAt: Date
}
```

---

## Task 1: Env scaffold + DB table

**Files:**
- Modify: `.env.example`
- Modify: `lib/db.ts` (inside `SCHEMA_SQL`)

- [ ] **Step 1: Append X OAuth vars to `.env.example`**

Append these lines (generate the enc key with the command in Step 2):

```
# ── X (Twitter) API OAuth 2.0 ──────────────────────────────────────────────
# From the X Developer Portal → your app → "User authentication settings".
X_CLIENT_ID=
X_CLIENT_SECRET=
# Must EXACTLY match a Callback URI registered in the portal.
X_REDIRECT_URI=http://localhost:3000/api/x/callback
# 32 random bytes, base64. Encrypts X tokens at rest. Generate:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
X_TOKEN_ENC_KEY=
```

- [ ] **Step 2: Generate a sample enc key (for local `.env`, not committed)**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
Expected: a 44-char base64 string. (The operator pastes real values later; this just confirms the command works.)

- [ ] **Step 3: Add the `x_accounts` table to `SCHEMA_SQL`**

In `lib/db.ts`, inside the `SCHEMA_SQL` template literal, after the `compose_history` block (around line 73), add:

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

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add .env.example lib/db.ts
git commit -m "scaffold x accounts table"
```

---

## Task 2: `lib/x/errors.ts` + `lib/x/config.ts`

**Files:**
- Create: `lib/x/errors.ts`
- Create: `lib/x/config.ts`

- [ ] **Step 1: Create `lib/x/errors.ts`**

```ts
// Typed errors for the X integration. Routes map these to clean HTTP responses.

export class XNotConnectedError extends Error {
  constructor() {
    super('Connect your X account first.')
    this.name = 'XNotConnectedError'
  }
}

export class XAuthError extends Error {
  constructor(message = 'X authorization failed. Reconnect your account.') {
    super(message)
    this.name = 'XAuthError'
  }
}

/** Reading the user's timeline needs X API Basic+ (Free tier returns 403). */
export class ImportNotAvailableError extends Error {
  constructor() {
    super('Importing your X posts needs X API Basic access. Publishing still works.')
    this.name = 'ImportNotAvailableError'
  }
}

export class PublishError extends Error {
  constructor(message = 'Could not publish to X. Try again.') {
    super(message)
    this.name = 'PublishError'
  }
}
```

- [ ] **Step 2: Create `lib/x/config.ts`**

```ts
// Centralized X OAuth env access. Throws if the operator has not pasted keys.

export type XConfig = { clientId: string; clientSecret: string; redirectUri: string }

export function xConfig(): XConfig {
  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  const redirectUri = process.env.X_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('X OAuth is not configured (set X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI).')
  }
  return { clientId, clientSecret, redirectUri }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/x/errors.ts lib/x/config.ts
git commit -m "add x errors and config"
```

---

## Task 3: `lib/x/crypto.ts` (AES-256-GCM token encryption)

**Files:**
- Create: `lib/x/crypto.ts`
- Test: `lib/x/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/x/crypto.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { decryptToken, encryptToken } from './crypto'

beforeEach(() => {
  process.env.X_TOKEN_ENC_KEY = randomBytes(32).toString('base64')
})

describe('token crypto', () => {
  it('round-trips a token', () => {
    const secret = 'access-token-abc.123'
    expect(decryptToken(encryptToken(secret))).toBe(secret)
  })

  it('produces different ciphertext each time (random IV)', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'))
  })

  it('throws on a tampered payload', () => {
    const enc = encryptToken('secret')
    const tampered = enc.slice(0, -4) + (enc.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('throws when the key is the wrong size', () => {
    process.env.X_TOKEN_ENC_KEY = randomBytes(16).toString('base64')
    expect(() => encryptToken('x')).toThrow(/32 bytes/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/x/crypto.test.ts`
Expected: FAIL — cannot find module `./crypto`.

- [ ] **Step 3: Write `lib/x/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM. Stored format: base64( iv[12] | authTag[16] | ciphertext ).

function key(): Buffer {
  const raw = process.env.X_TOKEN_ENC_KEY
  if (!raw) throw new Error('X_TOKEN_ENC_KEY is not set')
  const k = Buffer.from(raw, 'base64')
  if (k.length !== 32) throw new Error('X_TOKEN_ENC_KEY must decode to 32 bytes (base64)')
  return k
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/x/crypto.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/x/crypto.ts lib/x/crypto.test.ts
git commit -m "add token encryption"
```

---

## Task 4: `lib/x/oauth.ts` (PKCE + token exchange)

**Files:**
- Create: `lib/x/oauth.ts`
- Test: `lib/x/oauth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/x/oauth.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { base64url, buildAuthUrl, exchangeCode, makePkce, makeState, refreshToken, X_SCOPES } from './oauth'

afterEach(() => vi.unstubAllGlobals())

describe('pkce', () => {
  it('derives a valid S256 challenge from the verifier', () => {
    const { verifier, challenge } = makePkce()
    const expected = base64url(createHash('sha256').update(verifier).digest())
    expect(challenge).toBe(expected)
    expect(verifier).not.toContain('=')
    expect(challenge).not.toContain('=')
  })

  it('makeState is URL-safe and non-empty', () => {
    expect(makeState()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('buildAuthUrl', () => {
  it('includes all required authorize params', () => {
    const url = new URL(
      buildAuthUrl({ clientId: 'cid', redirectUri: 'https://app/cb', state: 'st', challenge: 'ch' }),
    )
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/cb')
    expect(url.searchParams.get('scope')).toBe(X_SCOPES)
    expect(url.searchParams.get('state')).toBe('st')
    expect(url.searchParams.get('code_challenge')).toBe('ch')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })
})

describe('exchangeCode', () => {
  it('POSTs the authorization_code grant with Basic auth and returns tokens', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 7200, scope: X_SCOPES, token_type: 'bearer' }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const tok = await exchangeCode({ code: 'c', verifier: 'v', clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://app/cb' })
    expect(tok.access_token).toBe('at')

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>).authorization).toBe('Basic ' + Buffer.from('cid:sec').toString('base64'))
    const body = (init.body as URLSearchParams)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('c')
    expect(body.get('code_verifier')).toBe('v')
  })

  it('throws XAuthError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
    await expect(exchangeCode({ code: 'c', verifier: 'v', clientId: 'cid', clientSecret: 'sec', redirectUri: 'r' })).rejects.toThrow(/X authorization/)
  })
})

describe('refreshToken', () => {
  it('POSTs the refresh_token grant', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ access_token: 'at2', refresh_token: 'rt2', expires_in: 7200, scope: X_SCOPES, token_type: 'bearer' }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const tok = await refreshToken({ refreshToken: 'rt', clientId: 'cid', clientSecret: 'sec' })
    expect(tok.access_token).toBe('at2')
    expect((fetchMock.mock.calls[0][1].body as URLSearchParams).get('grant_type')).toBe('refresh_token')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/x/oauth.test.ts`
Expected: FAIL — cannot find module `./oauth`.

- [ ] **Step 3: Write `lib/x/oauth.ts`**

```ts
import { createHash, randomBytes } from 'node:crypto'
import { XAuthError } from './errors'

const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
export const X_SCOPES = 'tweet.read tweet.write users.read offline.access'

export type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function makePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function makeState(): string {
  return base64url(randomBytes(16))
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const u = new URL(AUTHORIZE_URL)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', p.clientId)
  u.searchParams.set('redirect_uri', p.redirectUri)
  u.searchParams.set('scope', X_SCOPES)
  u.searchParams.set('state', p.state)
  u.searchParams.set('code_challenge', p.challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  return u.toString()
}

function basicAuth(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

async function tokenRequest(body: URLSearchParams, clientId: string, clientSecret: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basicAuth(clientId, clientSecret) },
    body,
  })
  if (!res.ok) throw new XAuthError()
  return (await res.json()) as TokenResponse
}

export async function exchangeCode(p: {
  code: string
  verifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: p.code,
    redirect_uri: p.redirectUri,
    code_verifier: p.verifier,
    client_id: p.clientId,
  })
  return tokenRequest(body, p.clientId, p.clientSecret)
}

export async function refreshToken(p: { refreshToken: string; clientId: string; clientSecret: string }): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: p.refreshToken,
    client_id: p.clientId,
  })
  return tokenRequest(body, p.clientId, p.clientSecret)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/x/oauth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/x/oauth.ts lib/x/oauth.test.ts
git commit -m "add x oauth helpers"
```

---

## Task 5: `lib/x/stateCookie.ts` (signed PKCE/state transaction)

**Files:**
- Create: `lib/x/stateCookie.ts`
- Test: `lib/x/stateCookie.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/x/stateCookie.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { openOAuthTx, sealOAuthTx } from './stateCookie'

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-chars-long-xx'
})

describe('oauth tx cookie', () => {
  it('round-trips state + verifier', async () => {
    const token = await sealOAuthTx({ state: 'st', verifier: 'vf' })
    expect(await openOAuthTx(token)).toEqual({ state: 'st', verifier: 'vf' })
  })

  it('returns null for a missing token', async () => {
    expect(await openOAuthTx(undefined)).toBeNull()
  })

  it('returns null for a tampered token', async () => {
    const token = await sealOAuthTx({ state: 'st', verifier: 'vf' })
    expect(await openOAuthTx(token + 'x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/x/stateCookie.test.ts`
Expected: FAIL — cannot find module `./stateCookie`.

- [ ] **Step 3: Write `lib/x/stateCookie.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose'

// The PKCE verifier + CSRF state, sealed into a short-lived signed cookie that
// /connect sets and /callback reads. Reuses AUTH_SECRET (HS256), like auth/jwt.ts.

export const X_OAUTH_COOKIE = 'x_oauth_tx'
export const X_OAUTH_MAX_AGE_S = 600 // 10 minutes

export type OAuthTx = { state: string; verifier: string }

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(s)
}

export async function sealOAuthTx(tx: OAuthTx): Promise<string> {
  return new SignJWT({ state: tx.state, verifier: tx.verifier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${X_OAUTH_MAX_AGE_S}s`)
    .sign(secret())
}

export async function openOAuthTx(token: string | undefined): Promise<OAuthTx | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.state !== 'string' || typeof payload.verifier !== 'string') return null
    return { state: payload.state, verifier: payload.verifier }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/x/stateCookie.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/x/stateCookie.ts lib/x/stateCookie.test.ts
git commit -m "add oauth tx cookie"
```

---

## Task 6: `lib/x/store.ts` (token persistence + refresh)

**Files:**
- Create: `lib/x/store.ts`
- Test: `lib/x/store.test.ts` (pure `isExpiring` helper only — DB calls follow the codebase convention of being covered via mocked route tests)

- [ ] **Step 1: Write the failing test**

```ts
// lib/x/store.test.ts
import { describe, expect, it } from 'vitest'
import { isExpiring } from './store'

describe('isExpiring', () => {
  const now = new Date('2026-06-05T12:00:00Z')

  it('true when the token is already expired', () => {
    expect(isExpiring(new Date('2026-06-05T11:59:00Z'), now)).toBe(true)
  })

  it('true within the 60s refresh skew', () => {
    expect(isExpiring(new Date('2026-06-05T12:00:30Z'), now)).toBe(true)
  })

  it('false when comfortably valid', () => {
    expect(isExpiring(new Date('2026-06-05T13:00:00Z'), now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/x/store.test.ts`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Write `lib/x/store.ts`**

```ts
import { ensureSchema, getPool } from '@/lib/db'
import { decryptToken, encryptToken } from './crypto'
import { xConfig } from './config'
import { refreshToken } from './oauth'
import { XAuthError, XNotConnectedError } from './errors'

export type XAccount = {
  userId: string
  xUserId: string
  username: string
  scope: string
  expiresAt: string
}

export type SaveAccountInput = {
  userId: string
  xUserId: string
  username: string
  accessToken: string
  refreshToken?: string
  scope: string
  expiresAt: Date
}

type Row = {
  user_id: string
  x_user_id: string
  username: string
  access_token_enc: string
  refresh_token_enc: string | null
  scope: string
  expires_at: Date
}

const REFRESH_SKEW_MS = 60_000

/** True when the token is expired or will expire within the refresh skew. */
export function isExpiring(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_SKEW_MS
}

export async function saveAccount(i: SaveAccountInput): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `INSERT INTO x_accounts (user_id, x_user_id, username, access_token_enc, refresh_token_enc, scope, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       x_user_id = EXCLUDED.x_user_id,
       username = EXCLUDED.username,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       scope = EXCLUDED.scope,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()`,
    [
      i.userId,
      i.xUserId,
      i.username,
      encryptToken(i.accessToken),
      i.refreshToken ? encryptToken(i.refreshToken) : null,
      i.scope,
      i.expiresAt,
    ],
  )
}

export async function getAccount(userId: string): Promise<XAccount | null> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>('SELECT * FROM x_accounts WHERE user_id = $1', [userId])
  const r = rows[0]
  if (!r) return null
  return {
    userId: r.user_id,
    xUserId: r.x_user_id,
    username: r.username,
    scope: r.scope,
    expiresAt: r.expires_at.toISOString(),
  }
}

export async function deleteAccount(userId: string): Promise<boolean> {
  await ensureSchema()
  const { rowCount } = await getPool().query('DELETE FROM x_accounts WHERE user_id = $1', [userId])
  return (rowCount ?? 0) > 0
}

/** A usable access token, refreshing transparently when it is expiring. */
export async function getValidAccessToken(userId: string): Promise<string> {
  await ensureSchema()
  const { rows } = await getPool().query<Row>('SELECT * FROM x_accounts WHERE user_id = $1', [userId])
  const r = rows[0]
  if (!r) throw new XNotConnectedError()

  if (!isExpiring(r.expires_at, new Date())) return decryptToken(r.access_token_enc)
  if (!r.refresh_token_enc) throw new XAuthError()

  const { clientId, clientSecret } = xConfig()
  const tok = await refreshToken({
    refreshToken: decryptToken(r.refresh_token_enc),
    clientId,
    clientSecret,
  })
  await saveAccount({
    userId,
    xUserId: r.x_user_id,
    username: r.username,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token ?? decryptToken(r.refresh_token_enc),
    scope: tok.scope,
    expiresAt: new Date(Date.now() + tok.expires_in * 1000),
  })
  return tok.access_token
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/x/store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/x/store.ts lib/x/store.test.ts
git commit -m "add x account store"
```

---

## Task 7: `lib/x/client.ts` (X API v2 calls)

**Files:**
- Create: `lib/x/client.ts`
- Test: `lib/x/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/x/client.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOriginalTweets, getMe, postTweet } from './client'

afterEach(() => vi.unstubAllGlobals())

describe('getMe', () => {
  it('returns id + username', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { id: '42', username: 'ada' } }), { status: 200 })))
    expect(await getMe('tok')).toEqual({ id: '42', username: 'ada' })
  })

  it('throws XAuthError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(getMe('tok')).rejects.toThrow(/X authorization/)
  })
})

describe('postTweet', () => {
  it('posts text and returns the new tweet id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: '999', text: 'hi' } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await postTweet('tok', 'hi')).toEqual({ id: '999' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.x.com/2/tweets')
    expect(JSON.parse(init.body as string)).toEqual({ text: 'hi' })
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('throws PublishError with X detail on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Text too long.' }), { status: 403 })))
    await expect(postTweet('tok', 'x')).rejects.toThrow('Text too long.')
  })
})

describe('fetchOriginalTweets', () => {
  it('returns trimmed non-empty texts, preferring note_tweet long text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [
        { id: '1', text: ' short ' },
        { id: '2', text: 'truncated…', note_tweet: { text: 'the full long post' } },
        { id: '3', text: '   ' },
      ],
    }), { status: 200 })))
    expect(await fetchOriginalTweets('tok', '42', 20)).toEqual(['short', 'the full long post'])
  })

  it('throws ImportNotAvailableError on 403 (tier gate)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })))
    await expect(fetchOriginalTweets('tok', '42', 20)).rejects.toThrow(/Basic access/)
  })

  it('returns [] when the user has no posts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ meta: { result_count: 0 } }), { status: 200 })))
    expect(await fetchOriginalTweets('tok', '42', 20)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/x/client.test.ts`
Expected: FAIL — cannot find module `./client`.

- [ ] **Step 3: Write `lib/x/client.ts`**

```ts
import { ImportNotAvailableError, PublishError, XAuthError } from './errors'

const API = 'https://api.x.com/2'

type Json = Record<string, unknown> | null

async function readJson(res: Response): Promise<Json> {
  return (await res.json().catch(() => null)) as Json
}

export async function getMe(accessToken: string): Promise<{ id: string; username: string }> {
  const res = await fetch(`${API}/users/me`, { headers: { authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new XAuthError()
  const data = (await readJson(res)) as { data?: { id?: string; username?: string } } | null
  if (!data?.data?.id || !data.data.username) throw new XAuthError()
  return { id: data.data.id, username: data.data.username }
}

export async function postTweet(accessToken: string, text: string): Promise<{ id: string }> {
  const res = await fetch(`${API}/tweets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = (await readJson(res)) as { data?: { id?: string }; detail?: string; title?: string } | null
  if (!res.ok || !data?.data?.id) throw new PublishError(data?.detail || data?.title || 'Could not publish to X.')
  return { id: data.data.id }
}

/** The user's own recent ORIGINAL posts (no retweets/replies), as plain text. */
export async function fetchOriginalTweets(accessToken: string, xUserId: string, max: number): Promise<string[]> {
  const u = new URL(`${API}/users/${xUserId}/tweets`)
  u.searchParams.set('max_results', String(Math.min(100, Math.max(5, max))))
  u.searchParams.set('exclude', 'retweets,replies')
  u.searchParams.set('tweet.fields', 'text,note_tweet')
  const res = await fetch(u, { headers: { authorization: `Bearer ${accessToken}` } })
  if (res.status === 403) throw new ImportNotAvailableError()
  if (!res.ok) throw new XAuthError()
  const data = (await readJson(res)) as { data?: Array<{ text?: string; note_tweet?: { text?: string } }> } | null
  const arr = Array.isArray(data?.data) ? data!.data! : []
  return arr.map((t) => (t.note_tweet?.text || t.text || '').trim()).filter(Boolean)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/x/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/x/client.ts lib/x/client.test.ts
git commit -m "add x api client"
```

---

## Task 8: `POST /api/x/publish` route

**Files:**
- Create: `app/api/x/publish/route.ts`
- Test: `app/api/x/publish/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/x/publish/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock, tokenMock, postMock, accountMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  tokenMock: vi.fn(),
  postMock: vi.fn(),
  accountMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/x/store', () => ({ getValidAccessToken: tokenMock, getAccount: accountMock }))
vi.mock('@/lib/x/client', () => ({ postTweet: postMock }))

import { POST } from '@/app/api/x/publish/route'
import { XNotConnectedError } from '@/lib/x/errors'

const json = (b: unknown) =>
  new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  sessionMock.mockReset(); tokenMock.mockReset(); postMock.mockReset(); accountMock.mockReset()
  sessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  tokenMock.mockResolvedValue('tok')
  postMock.mockResolvedValue({ id: '999' })
  accountMock.mockResolvedValue({ userId: 'u1', xUserId: '42', username: 'ada', scope: '', expiresAt: '' })
})

describe('POST /api/x/publish', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await POST(json({ text: 'hi' }))).status).toBe(401)
  })

  it('400 on empty text', async () => {
    expect((await POST(json({ text: '   ' }))).status).toBe(400)
    expect(postMock).not.toHaveBeenCalled()
  })

  it('publishes and returns the tweet url', async () => {
    const res = await POST(json({ text: 'shipped dark mode' }))
    expect(res.status).toBe(200)
    expect(postMock).toHaveBeenCalledWith('tok', 'shipped dark mode')
    expect((await res.json()).url).toBe('https://x.com/ada/status/999')
  })

  it('409 when not connected', async () => {
    tokenMock.mockRejectedValue(new XNotConnectedError())
    expect((await POST(json({ text: 'hi' }))).status).toBe(409)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/x/publish/route.test.ts`
Expected: FAIL — cannot find module `@/app/api/x/publish/route`.

- [ ] **Step 3: Write `app/api/x/publish/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount, getValidAccessToken } from '@/lib/x/store'
import { postTweet } from '@/lib/x/client'
import { PublishError, XNotConnectedError } from '@/lib/x/errors'

const TEXT_MAX = 25000 // X long-post ceiling; account tier enforces the real limit.

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
  if (text.length > TEXT_MAX) return NextResponse.json({ error: 'That post is too long.' }, { status: 400 })

  try {
    const token = await getValidAccessToken(session.userId)
    const { id } = await postTweet(token, text)
    const account = await getAccount(session.userId)
    const url = account ? `https://x.com/${account.username}/status/${id}` : `https://x.com/i/web/status/${id}`
    return NextResponse.json({ id, url })
  } catch (err) {
    if (err instanceof XNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof PublishError) return NextResponse.json({ error: err.message }, { status: 502 })
    console.error('[x/publish] failed:', err)
    return NextResponse.json({ error: 'Could not publish to X. Try again.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/x/publish/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/x/publish/route.ts app/api/x/publish/route.test.ts
git commit -m "add x publish route"
```

---

## Task 9: `POST /api/x/import` route

**Files:**
- Create: `app/api/x/import/route.ts`
- Test: `app/api/x/import/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/x/import/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock, tokenMock, accountMock, fetchTweetsMock, getProfileMock, addSamplesMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  tokenMock: vi.fn(),
  accountMock: vi.fn(),
  fetchTweetsMock: vi.fn(),
  getProfileMock: vi.fn(),
  addSamplesMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/x/store', () => ({ getValidAccessToken: tokenMock, getAccount: accountMock }))
vi.mock('@/lib/x/client', () => ({ fetchOriginalTweets: fetchTweetsMock }))
vi.mock('@/lib/voice/store', () => ({ getProfile: getProfileMock }))
vi.mock('@/lib/voice/samples', () => ({ addSamples: addSamplesMock }))

import { POST } from '@/app/api/x/import/route'
import { ImportNotAvailableError } from '@/lib/x/errors'

const json = (b: unknown) =>
  new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  sessionMock.mockReset(); tokenMock.mockReset(); accountMock.mockReset(); fetchTweetsMock.mockReset(); getProfileMock.mockReset(); addSamplesMock.mockReset()
  sessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  getProfileMock.mockResolvedValue({ id: 'p1' })
  accountMock.mockResolvedValue({ userId: 'u1', xUserId: '42', username: 'ada', scope: '', expiresAt: '' })
  tokenMock.mockResolvedValue('tok')
  fetchTweetsMock.mockResolvedValue(['post one', 'post two'])
  addSamplesMock.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
})

describe('POST /api/x/import', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await POST(json({ profileId: 'p1' }))).status).toBe(401)
  })

  it('404 when the profile is not the user’s', async () => {
    getProfileMock.mockResolvedValue(null)
    expect((await POST(json({ profileId: 'p1' }))).status).toBe(404)
  })

  it('409 when no X account connected', async () => {
    accountMock.mockResolvedValue(null)
    expect((await POST(json({ profileId: 'p1' }))).status).toBe(409)
    expect(fetchTweetsMock).not.toHaveBeenCalled()
  })

  it('imports posts as x samples', async () => {
    const res = await POST(json({ profileId: 'p1' }))
    expect(res.status).toBe(200)
    expect(fetchTweetsMock).toHaveBeenCalledWith('tok', '42', 20)
    expect(addSamplesMock).toHaveBeenCalledWith('u1', 'p1', [
      { source: 'x', text: 'post one' },
      { source: 'x', text: 'post two' },
    ])
    expect((await res.json()).added).toBe(2)
  })

  it('409 with the tier message when import is gated', async () => {
    fetchTweetsMock.mockRejectedValue(new ImportNotAvailableError())
    const res = await POST(json({ profileId: 'p1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/Basic access/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/x/import/route.test.ts`
Expected: FAIL — cannot find module `@/app/api/x/import/route`.

- [ ] **Step 3: Write `app/api/x/import/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/voice/store'
import { addSamples } from '@/lib/voice/samples'
import { getAccount, getValidAccessToken } from '@/lib/x/store'
import { fetchOriginalTweets } from '@/lib/x/client'
import { ImportNotAvailableError, XNotConnectedError } from '@/lib/x/errors'

const IMPORT_COUNT = 20

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const profileId = typeof (body as { profileId?: unknown })?.profileId === 'string' ? (body as { profileId: string }).profileId : ''
  if (!profileId) return NextResponse.json({ error: 'No voice selected.' }, { status: 400 })

  const profile = await getProfile(session.userId, profileId)
  if (!profile) return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })

  const account = await getAccount(session.userId)
  if (!account) return NextResponse.json({ error: 'Connect your X account first.' }, { status: 409 })

  try {
    const token = await getValidAccessToken(session.userId)
    const texts = await fetchOriginalTweets(token, account.xUserId, IMPORT_COUNT)
    if (!texts.length) return NextResponse.json({ error: 'No original posts found to import.' }, { status: 400 })
    const created = await addSamples(
      session.userId,
      profileId,
      texts.map((text) => ({ source: 'x' as const, text })),
    )
    return NextResponse.json({ added: created.length, samples: created })
  } catch (err) {
    if (err instanceof ImportNotAvailableError) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof XNotConnectedError) return NextResponse.json({ error: err.message }, { status: 409 })
    console.error('[x/import] failed:', err)
    return NextResponse.json({ error: 'Could not import your posts. Try again.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/x/import/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/x/import/route.ts app/api/x/import/route.test.ts
git commit -m "add x import route"
```

---

## Task 10: `GET /api/x/status` + `POST /api/x/disconnect`

**Files:**
- Create: `app/api/x/status/route.ts`
- Create: `app/api/x/disconnect/route.ts`
- Test: `app/api/x/status/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/x/status/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock, accountMock } = vi.hoisted(() => ({ sessionMock: vi.fn(), accountMock: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/x/store', () => ({ getAccount: accountMock }))

import { GET } from '@/app/api/x/status/route'

beforeEach(() => {
  sessionMock.mockReset(); accountMock.mockReset()
  sessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
})

describe('GET /api/x/status', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it('reports disconnected', async () => {
    accountMock.mockResolvedValue(null)
    expect(await (await GET()).json()).toEqual({ connected: false })
  })

  it('reports the connected username + scope', async () => {
    accountMock.mockResolvedValue({ userId: 'u1', xUserId: '42', username: 'ada', scope: 'tweet.read tweet.write', expiresAt: '' })
    expect(await (await GET()).json()).toEqual({ connected: true, username: 'ada', scope: 'tweet.read tweet.write' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/x/status/route.test.ts`
Expected: FAIL — cannot find module `@/app/api/x/status/route`.

- [ ] **Step 3: Write `app/api/x/status/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAccount } from '@/lib/x/store'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const account = await getAccount(session.userId)
  if (!account) return NextResponse.json({ connected: false })
  return NextResponse.json({ connected: true, username: account.username, scope: account.scope })
}
```

- [ ] **Step 4: Write `app/api/x/disconnect/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { deleteAccount } from '@/lib/x/store'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  await deleteAccount(session.userId)
  return NextResponse.json({ connected: false })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/api/x/status/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/x/status/route.ts app/api/x/disconnect/route.ts app/api/x/status/route.test.ts
git commit -m "add x status and disconnect"
```

---

## Task 11: `GET /api/x/connect` + `GET /api/x/callback` (OAuth redirect routes)

These are thin redirect/cookie orchestration over already-tested units. No unit test (consistent with the codebase, which does not test redirect/cookie flows); verified manually in Task 15.

**Files:**
- Create: `app/api/x/connect/route.ts`
- Create: `app/api/x/callback/route.ts`

- [ ] **Step 1: Write `app/api/x/connect/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { xConfig } from '@/lib/x/config'
import { buildAuthUrl, makePkce, makeState } from '@/lib/x/oauth'
import { sealOAuthTx, X_OAUTH_COOKIE, X_OAUTH_MAX_AGE_S } from '@/lib/x/stateCookie'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const { clientId, redirectUri } = xConfig()
  const { verifier, challenge } = makePkce()
  const state = makeState()

  const res = NextResponse.redirect(buildAuthUrl({ clientId, redirectUri, state, challenge }))
  res.cookies.set(X_OAUTH_COOKIE, await sealOAuthTx({ state, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: X_OAUTH_MAX_AGE_S,
  })
  return res
}
```

- [ ] **Step 2: Write `app/api/x/callback/route.ts`**

```ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { xConfig } from '@/lib/x/config'
import { exchangeCode } from '@/lib/x/oauth'
import { openOAuthTx, X_OAUTH_COOKIE } from '@/lib/x/stateCookie'
import { getMe } from '@/lib/x/client'
import { saveAccount } from '@/lib/x/store'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const back = new URL('/app/profile', req.url)

  const txToken = (await cookies()).get(X_OAUTH_COOKIE)?.value
  const tx = await openOAuthTx(txToken)

  if (!code || !state || !tx || tx.state !== state) {
    back.searchParams.set('x', 'error')
    const res = NextResponse.redirect(back)
    res.cookies.delete(X_OAUTH_COOKIE)
    return res
  }

  try {
    const { clientId, clientSecret, redirectUri } = xConfig()
    const tok = await exchangeCode({ code, verifier: tx.verifier, clientId, clientSecret, redirectUri })
    const me = await getMe(tok.access_token)
    await saveAccount({
      userId: session.userId,
      xUserId: me.id,
      username: me.username,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      scope: tok.scope,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    })
    back.searchParams.set('x', 'connected')
  } catch (err) {
    console.error('[x/callback] failed:', err)
    back.searchParams.set('x', 'error')
  }

  const res = NextResponse.redirect(back)
  res.cookies.delete(X_OAUTH_COOKIE)
  return res
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/x/connect/route.ts app/api/x/callback/route.ts
git commit -m "add x oauth routes"
```

---

## Task 12: `XConnection` UI + wire into profile page

**Files:**
- Create: `components/app/XConnection.tsx`
- Modify: `app/app/profile/page.tsx`

- [ ] **Step 1: Write `components/app/XConnection.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = { connected: boolean; username?: string; scope?: string }

export function XConnection({ flash }: { flash?: 'connected' | 'error' }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/x/status')
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
  }, [])

  async function disconnect() {
    setBusy(true)
    try {
      await fetch('/api/x/disconnect', { method: 'POST' })
      setStatus({ connected: false })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-muted bg-surface-container-low p-4">
      <div className="flex items-center justify-between">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">X account</span>
        {status?.connected ? (
          <span className="font-body-sm text-body-sm text-cyber-lime">Connected as @{status.username}</span>
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant/60">Not connected</span>
        )}
      </div>

      {flash === 'connected' && <p className="font-body-sm text-body-sm text-cyber-lime">X account connected.</p>}
      {flash === 'error' && <p className="font-body-sm text-body-sm text-error">Could not connect X. Try again.</p>}

      {status?.connected ? (
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="self-start rounded-full border border-border-muted px-5 py-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-error disabled:opacity-60"
        >
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <a
          href="/api/x/connect"
          className="self-start rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-all hover:bg-primary-container active:scale-95"
        >
          Connect X
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Render it in `app/app/profile/page.tsx`**

Make the component read the `?x=` flash. Change the signature and body:

```tsx
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { ProfileForm } from '@/components/app/ProfileForm'
import { XConnection } from '@/components/app/XConnection'

export const metadata = { title: 'Outloud | Profile' }

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ x?: string }> }) {
  const session = await getSession()
  if (!session) return null
  const profile = await getProfile(session.userId)
  const { x } = await searchParams
  const flash = x === 'connected' || x === 'error' ? x : undefined

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 font-headline-xl text-headline-xl">Your profile</h1>
      <p className="mb-8 font-body-md text-body-md text-on-surface-variant">{session.email}</p>
      <ProfileForm
        initial={{
          displayName: profile?.displayName ?? '',
          handle: profile?.handle ?? '',
          avatarUrl: profile?.avatarUrl ?? '',
          plan: profile?.plan ?? 'free',
        }}
      />
      <div className="mt-8">
        <XConnection flash={flash} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/app/XConnection.tsx app/app/profile/page.tsx
git commit -m "add x connection ui"
```

---

## Task 13: "Publish to X" button on drafts

**Files:**
- Modify: `components/app/ComposeHome.tsx` (the `DraftCard` component)

- [ ] **Step 1: Add publish state + handler to `DraftCard`**

In `components/app/ComposeHome.tsx`, replace the `DraftCard` function (lines 11–51) with:

```tsx
function DraftCard({ draft, index }: { draft: DraftPost; index: number }) {
  const [text, setText] = useState(draft.fullText)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function publish() {
    setPublishError('')
    setPublishedUrl('')
    setPublishing(true)
    try {
      const res = await fetch('/api/x/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPublishError(res.status === 409 ? 'Connect your X account in Profile first.' : data.error ?? 'Could not publish.')
        return
      }
      setPublishedUrl(data.url)
    } catch {
      setPublishError('Network error. Try again.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-code-label text-code-label uppercase tracking-wide text-on-surface-variant">
          Draft {index + 1}
          {draft.angle ? ` · ${draft.angle}` : ''}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing((e) => !e)} aria-pressed={editing} className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{editing ? 'check' : 'edit'}</span>
            {editing ? 'Done' : 'Edit'}
          </button>
          <button onClick={copy} className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">content_copy</span>
            <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-56 w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md leading-relaxed text-on-surface focus:border-electric-indigo focus:outline-none"
        />
      ) : (
        <p className="whitespace-pre-wrap font-body-md leading-relaxed text-on-surface">{text}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={publishing || !text.trim()}
          className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">send</span>
          {publishing ? 'Publishing…' : 'Publish to X'}
        </button>
        <span className="font-code-label text-code-label text-on-surface-variant/60">{text.length} chars</span>
        {publishedUrl && (
          <a href={publishedUrl} target="_blank" rel="noreferrer" className="font-code-label text-code-label text-cyber-lime hover:underline">
            View on X →
          </a>
        )}
      </div>
      {publishError && <p className="mt-2 font-body-sm text-body-sm text-error">{publishError}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/app/ComposeHome.tsx
git commit -m "add publish to x button"
```

---

## Task 14: "Import from X" action in StylePage

**Files:**
- Modify: `components/voice/StylePage.tsx`

- [ ] **Step 1: Add an import handler**

In `components/voice/StylePage.tsx`, add this state near the other `useState` hooks (after line 35, the `stale` state) inside `StylePage`:

```tsx
  const [importing, setImporting] = useState(false)
```

Then add this handler next to `submitAdd` / `onUpload` (after `onUpload`, around line 83):

```tsx
  async function importFromX() {
    setError('')
    setImporting(true)
    try {
      const res = await fetch('/api/x/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(res.status === 409 ? data.error ?? 'Connect your X account in Profile first.' : data.error ?? 'Could not import.')
        return
      }
      const added: WritingSample[] = data.samples ?? []
      setSamples((s) => [...added, ...s])
      if (guide && added.length) setStale(true)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setImporting(false)
    }
  }
```

- [ ] **Step 2: Add the "Import from X" button to the add-source controls**

Find the add-source button group in the JSX (the block that toggles `addMode` to `'paste'` / `'url'` and the upload input). Add this button alongside them:

```tsx
        <button
          type="button"
          onClick={importFromX}
          disabled={importing}
          className="flex items-center gap-1.5 rounded-lg border border-border-muted px-3 py-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-60"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">download</span>
          {importing ? 'Importing…' : 'Import from X'}
        </button>
```

(If the exact add-source group is unclear at implementation time, place this button immediately before the existing `error` paragraph render so it sits with the other add controls. The behavior is unchanged either way.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/voice/StylePage.tsx
git commit -m "add import from x action"
```

---

## Task 15: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all tests pass, including the new `lib/x/*.test.ts` and `app/api/x/*/route.test.ts`.

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 3: Manual OAuth smoke test (requires real keys)**

Prereq: the operator pasted `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI`, `X_TOKEN_ENC_KEY` into `.env.local`, and registered `http://localhost:3000/api/x/callback` as a Callback URI in the X portal (app type: "Web App" / confidential client; scopes include tweet.write).

Run: `npm run dev`, then:
1. Sign in, open `/app/profile`, click **Connect X** → authorize on X → redirected back showing "Connected as @handle".
2. Open the composer, generate a draft, click **Publish to X** → a live tweet link appears; open it to confirm.
3. Open a voice's Style page, click **Import from X**:
   - On Free tier: a clear "needs X API Basic access" message (no crash).
   - On Basic+: your recent posts appear as samples.
4. Back on `/app/profile`, click **Disconnect** → state returns to "Not connected".

- [ ] **Step 4: Final commit (if any doc/cleanup changes)**

```bash
git add -A
git commit -m "verify x integration" --allow-empty
```

---

## Self-Review notes

- **Spec coverage:** credentials scaffold (T1), `x_accounts` table (T1), `lib/x/` module crypto/oauth/store/client/errors (T2–T7), all six routes (T8–T11), settings/publish/import UI (T12–T14), security via PKCE+state signed cookie and AES-256-GCM (T4/T5/T3/T6), tier-gated import (T7 client + T9 route), post-length soft validation (T8), testing (TDD throughout). All spec sections map to a task.
- **Type consistency:** `TokenResponse`, `XAccount`, `SaveAccountInput` defined once and reused; `getValidAccessToken(userId)`, `getAccount(userId)`, `postTweet(accessToken, text)`, `fetchOriginalTweets(accessToken, xUserId, max)` signatures match across client, store, routes, and tests.
- **Gating:** `ImportNotAvailableError` (403) surfaces as a friendly 409 in the import route and a non-crashing message in the UI; publishing is independent.
