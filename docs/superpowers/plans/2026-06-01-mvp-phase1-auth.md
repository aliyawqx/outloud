# Outloud MVP — Phase 1: Auth + App Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Sign in with X" auth and a protected authenticated app shell to the existing Next.js app, with a `users` row upserted on every sign-in.

**Architecture:** Auth.js (NextAuth v5) with the Twitter (X) OAuth2 provider and JWT sessions — no DB adapter. On sign-in we map the X profile to our own `users` row and upsert it into Postgres. The `(app)` route group is protected by a server-side `auth()` check in its layout; unauthenticated visitors are redirected to `/signin`.

**Tech Stack:** Next.js 15 App Router, `next-auth@beta` (v5), PostgreSQL (`pg`), Vitest.

> **Commits:** The plan includes commit steps per the standard template. The user asked not to commit — **skip the `git commit` steps** unless they say otherwise.

> **Prerequisite (user-provided):** an X developer app with OAuth 2.0 enabled. Needed env vars: `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, `AUTH_SECRET`. Callback URL to register: `http://localhost:3000/api/auth/callback/twitter` (and the production origin equivalent). Build + unit tests do NOT need these; only live sign-in does.

---

## File Structure

- Create: `lib/authHelpers.ts` — pure `mapXProfileToUser(profile)`; no I/O, unit-tested.
- Create: `lib/users.ts` — `ensureUsersSchema()`, `upsertUser(u)`; DB I/O, integration-tested.
- Create: `db/auth-schema.sql` — `users` table DDL.
- Create: `lib/auth.ts` — NextAuth config (`handlers`, `auth`, `signIn`, `signOut`).
- Create: `app/api/auth/[...nextauth]/route.ts` — exports `GET`/`POST` from handlers.
- Create: `types/next-auth.d.ts` — augment session/JWT with `xId` + `handle`.
- Create: `app/signin/page.tsx` — sign-in screen with "Sign in with X" button.
- Create: `app/(app)/layout.tsx` — protected layout (redirects if no session) + app nav.
- Create: `app/(app)/compose/page.tsx` — placeholder authenticated landing page (real UI in Phase 3).
- Modify: `.env.example` — add the auth env vars.

---

### Task 1: Install Auth.js + env

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install next-auth v5**

Run: `npm i next-auth@beta`
Expected: adds `next-auth` to dependencies.

- [ ] **Step 2: Add env vars to `.env.example`**

Append to `.env.example`:

```
# Auth.js — Sign in with X (OAuth2)
AUTH_SECRET=generate-with-npx-auth-secret
AUTH_TWITTER_ID=your-x-oauth-client-id
AUTH_TWITTER_SECRET=your-x-oauth-client-secret
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Установлен next-auth и переменные окружения для входа через X"
```

---

### Task 2: Pure profile mapper (TDD)

The X OAuth2 profile nests fields under `profile.data`. This mapper isolates that shape so the rest of the code is testable and provider-agnostic.

**Files:**
- Create: `lib/authHelpers.ts`
- Test: `lib/authHelpers.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/authHelpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapXProfileToUser } from './authHelpers'

describe('mapXProfileToUser', () => {
  it('maps the X OAuth2 profile (data-wrapped) to our user shape', () => {
    const profile = {
      data: {
        id: '12345',
        name: 'Jack',
        username: 'jack_builds',
        profile_image_url: 'https://pbs.twimg.com/jack.jpg',
      },
    }
    expect(mapXProfileToUser(profile)).toEqual({
      x_id: '12345',
      handle: 'jack_builds',
      name: 'Jack',
      avatar_url: 'https://pbs.twimg.com/jack.jpg',
    })
  })

  it('lowercases the handle', () => {
    const profile = { data: { id: '1', name: 'A', username: 'Jack_Builds', profile_image_url: '' } }
    expect(mapXProfileToUser(profile).handle).toBe('jack_builds')
  })

  it('throws when id or username is missing', () => {
    expect(() => mapXProfileToUser({ data: { id: '', name: 'x', username: 'x', profile_image_url: '' } })).toThrow()
    expect(() => mapXProfileToUser({ data: { id: '1', name: 'x', username: '', profile_image_url: '' } })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- authHelpers`
Expected: FAIL — `mapXProfileToUser` not found.

- [ ] **Step 3: Implement** — `lib/authHelpers.ts`:

```ts
export type XProfile = {
  data?: { id?: string; name?: string; username?: string; profile_image_url?: string }
}
export type AppUser = { x_id: string; handle: string; name: string; avatar_url: string }

export function mapXProfileToUser(profile: XProfile): AppUser {
  const d = profile?.data ?? {}
  const x_id = (d.id ?? '').trim()
  const username = (d.username ?? '').trim()
  if (!x_id || !username) throw new Error('X profile missing id or username')
  return {
    x_id,
    handle: username.toLowerCase(),
    name: (d.name ?? username).trim(),
    avatar_url: d.profile_image_url ?? '',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- authHelpers`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/authHelpers.ts lib/authHelpers.test.ts
git commit -m "Добавлен маппер профиля X в пользователя"
```

---

### Task 3: users table + upsert

Reuses the existing `pg` pool pattern from `lib/db.ts` (singleton pool, `ensure*` schema, upsert returning `xmax = 0`).

**Files:**
- Create: `db/auth-schema.sql`
- Create: `lib/users.ts`
- Test: `lib/users.integration.test.ts`

- [ ] **Step 1: Write the DDL** — `db/auth-schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  x_id TEXT UNIQUE NOT NULL,
  handle TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Implement** — `lib/users.ts` (mirrors `lib/db.ts` pool usage):

```ts
import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppUser } from './authHelpers'

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    })
  }
  return pool
}

let schemaReady: Promise<void> | null = null
export function ensureUsersSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = readFileSync(join(process.cwd(), 'db', 'auth-schema.sql'), 'utf8')
    schemaReady = getPool().query(sql).then(() => undefined).catch((e) => { schemaReady = null; throw e })
  }
  return schemaReady
}

export type DbUser = AppUser & { id: number }

export async function upsertUser(u: AppUser): Promise<DbUser> {
  await ensureUsersSchema()
  const res = await getPool().query<DbUser>(
    `INSERT INTO users (x_id, handle, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (x_id)
     DO UPDATE SET handle = EXCLUDED.handle, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
     RETURNING id, x_id, handle, name, avatar_url`,
    [u.x_id, u.handle, u.name, u.avatar_url],
  )
  return res.rows[0]
}
```

- [ ] **Step 3: Write the integration test** — `lib/users.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { ensureUsersSchema, upsertUser } from './users'

const hasDb = !!process.env.DATABASE_URL
const d = hasDb ? describe : describe.skip

d('upsertUser (integration)', () => {
  beforeAll(async () => { await ensureUsersSchema() })

  it('inserts then updates the same x_id (no duplicate)', async () => {
    const a = await upsertUser({ x_id: 't1', handle: 'jack', name: 'Jack', avatar_url: '' })
    expect(a.handle).toBe('jack')
    const b = await upsertUser({ x_id: 't1', handle: 'jack2', name: 'Jack Two', avatar_url: 'x' })
    expect(b.id).toBe(a.id)
    expect(b.handle).toBe('jack2')
  })
})
```

- [ ] **Step 4: Run the integration test against a local Postgres**

Run: `DATABASE_URL="postgresql://postgres:pass@localhost:5433/outloud" npm test -- users.integration`
Expected: PASS (1 test). Without `DATABASE_URL` the suite is skipped — verify it does not fail.

- [ ] **Step 5: Commit**

```bash
git add db/auth-schema.sql lib/users.ts lib/users.integration.test.ts
git commit -m "Добавлена таблица users и upsert"
```

---

### Task 4: NextAuth config + session types

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`

- [ ] **Step 1: Implement the NextAuth config** — `lib/auth.ts`:

```ts
import NextAuth from 'next-auth'
import Twitter from 'next-auth/providers/twitter'
import { mapXProfileToUser } from './authHelpers'
import { upsertUser } from './users'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Twitter], // reads AUTH_TWITTER_ID / AUTH_TWITTER_SECRET from env
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    async signIn({ profile }) {
      if (profile) {
        try {
          await upsertUser(mapXProfileToUser(profile))
        } catch {
          return false
        }
      }
      return true
    },
    async jwt({ token, profile }) {
      if (profile) {
        const u = mapXProfileToUser(profile)
        token.xId = u.x_id
        token.handle = u.handle
        token.picture = u.avatar_url
        token.name = u.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.xId = (token.xId as string) ?? ''
        session.user.handle = (token.handle as string) ?? ''
      }
      return session
    },
  },
})
```

- [ ] **Step 2: Augment the session/JWT types** — `types/next-auth.d.ts`:

```ts
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      xId: string
      handle: string
      name?: string | null
      image?: string | null
      email?: string | null
    }
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    xId?: string
    handle?: string
  }
}
```

- [ ] **Step 3: Verify it type-checks via build**

Run: `npm run build`
Expected: compiles (the route in Task 5 may be needed first — if `build` complains only about a missing route, proceed to Task 5 then rebuild).

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts
git commit -m "Добавлена конфигурация NextAuth и типы сессии"
```

---

### Task 5: Auth route handler

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Implement** — `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles; route `/api/auth/[...nextauth]` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/
git commit -m "Добавлен роут-обработчик NextAuth"
```

---

### Task 6: Sign-in page

**Files:**
- Create: `app/signin/page.tsx`

Uses the existing design-system classes (`btn btn--primary`, `wrap`, `kicker`, etc.) from `app/globals.css`.

- [ ] **Step 1: Implement** — `app/signin/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { auth, signIn } from '@/lib/auth'

export default async function SignInPage() {
  const session = await auth()
  if (session) redirect('/compose')

  return (
    <main className="wrap" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div className="kicker" style={{ justifyContent: 'center', display: 'flex', marginBottom: 20 }}>
          outloud
        </div>
        <h1 className="h-sec" style={{ marginBottom: 14 }}>Sign in to Outloud</h1>
        <p className="lede" style={{ margin: '0 auto 28px' }}>
          Ship in public, in your voice. Sign in with X to capture your voice and start posting.
        </p>
        <form
          action={async () => {
            'use server'
            await signIn('twitter', { redirectTo: '/compose' })
          }}
        >
          <button type="submit" className="btn btn--primary btn--block">
            Sign in with X <span aria-hidden>→</span>
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles; `/signin` appears as a route.

- [ ] **Step 3: Commit**

```bash
git add app/signin/
git commit -m "Добавлена страница входа"
```

---

### Task 7: Protected app shell

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/compose/page.tsx`

- [ ] **Step 1: Implement the protected layout** — `app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/signin')

  return (
    <div>
      <header style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="wrap row center between" style={{ height: 64 }}>
          <a href="/compose" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18 }}>
            outloud
          </a>
          <nav className="row center gap-24" style={{ fontSize: 13.5 }}>
            <a href="/voice" className="dim mono">voice</a>
            <a href="/compose" className="dim mono">compose</a>
            <a href="/history" className="dim mono">history</a>
            <span className="mono" style={{ fontSize: 13, color: 'var(--faint)' }}>
              @{session.user.handle}
            </span>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/signin' })
              }}
            >
              <button type="submit" className="btn btn--ghost" style={{ padding: '8px 14px', fontSize: 13 }}>
                sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="wrap" style={{ padding: '40px 0' }}>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Implement the placeholder compose page** — `app/(app)/compose/page.tsx`:

```tsx
import { auth } from '@/lib/auth'

export default async function ComposePage() {
  const session = await auth()
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 16 }}>compose</div>
      <h1 className="h-sec" style={{ marginBottom: 12 }}>
        Welcome, @{session?.user.handle}.
      </h1>
      <p className="lede">Voice capture and generation land here in the next phases.</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: compiles; `/compose` appears as a route.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/"
git commit -m "Добавлена защищённая оболочка приложения и заглушка compose"
```

---

### Task 8: End-to-end sign-in verification (manual, needs X creds)

**Files:** none (verification only).

- [ ] **Step 1: Provide credentials**

Create `.env.local` with real `AUTH_SECRET` (run `npx auth secret`), `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, and `DATABASE_URL`. Register callback `http://localhost:3000/api/auth/callback/twitter` in the X developer app.

- [ ] **Step 2: Run the app**

Run: `npm run dev`
Visit `http://localhost:3000/compose` → expect redirect to `/signin`.

- [ ] **Step 3: Sign in**

Click "Sign in with X" → complete the X OAuth consent → expect redirect to `/compose` showing `@yourhandle`.

- [ ] **Step 4: Verify the users row**

Run: `psql "$DATABASE_URL" -c "SELECT x_id, handle FROM users;"`
Expected: one row with your X id + handle.

- [ ] **Step 5: Verify sign-out**

Click "sign out" → expect redirect to `/signin`; visiting `/compose` again redirects to `/signin`.

---

## Self-Review

- **Spec coverage (Phase 1 scope):** Sign in with X ✓ (T4–T6), JWT sessions ✓ (T4), upsert `users` on sign-in ✓ (T2–T4 signIn callback), protected `(app)` routes + redirect ✓ (T7), app shell nav with handle + sign-out ✓ (T7), env keys ✓ (T1). Phases 2–5 (voice, generation/refine, delivery/history, analytics) are intentionally separate plans.
- **Placeholder scan:** none — every code step has full code. (`compose`/`voice`/`history` real UIs are explicitly deferred to later phases, with a working placeholder page now.)
- **Type consistency:** `AppUser` ({x_id, handle, name, avatar_url}) defined in `authHelpers.ts` and reused by `users.ts` and `auth.ts`; `mapXProfileToUser` / `upsertUser` / `ensureUsersSchema` names consistent across tasks; session fields `xId`/`handle` consistent between `types/next-auth.d.ts`, the `session` callback, and the layout/page usage.
