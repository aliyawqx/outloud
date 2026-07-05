# Scheduling + Autopilot Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared posting calendar fed by two sources — manual scheduling from the composer and an autopilot background filler that generates posts in the user's voice about their interests — publishing to X and Threads via cron-triggered routes.

**Architecture:** Three new tables (`scheduled_posts`, `autopilot_settings`, `notifications`) appended to the runtime `SCHEMA_SQL`. New `lib/schedule/*` (slot math, store, conflict rule, single-post publish executor) and `lib/autopilot/*` (settings store, generation, output validator) reuse the existing voice-generation pipeline (`generatePost`), credit helpers (`deduct`/`refund`), and platform clients (`postTweet`/`publishThread`). Two `CRON_SECRET`-gated route handlers (`/api/cron/generate`, `/api/cron/publish`) are triggered by an EXTERNAL cron (cron-job.org / GitHub Actions) because the Vercel plan is Hobby (Vercel Cron there runs max once daily). UI: Schedule button in `DraftCard`, a calendar page, an autopilot settings page, a notifications bell, and a 4th onboarding step.

**Tech Stack:** Next.js 15 App Router, TypeScript, node-postgres (Neon), Anthropic SDK (existing pipeline), Tailwind 3 with Outloud tokens, vitest.

## Global Constraints

- Commit messages: **English, ≤5 words** (project memory overrides the global Russian rule).
- IDs: `id TEXT PRIMARY KEY`, generated in app code with `randomUUID()` from `node:crypto`. Never SQL defaults.
- Times: `TIMESTAMPTZ`, always stored UTC; IANA timezone string stored separately for display/slot math.
- Statuses/enums: plain `TEXT` with allowed values in a SQL comment (no Postgres ENUM). New DDL = `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` appended to `SCHEMA_SQL` in `lib/db.ts`, mirrored in `db/schema.sql`.
- **`DB_SKIP_SCHEMA=1` is set** — DDL will NOT auto-run. After the schema task, run `npx tsx scripts/sync-schema.ts` (created in Task 1) against the real DB or the new tables silently never exist.
- API routes: NO zod. Hand-validate `await req.json()` in try/catch → 400 `{ error: 'Invalid JSON' }`, per-field `typeof` guards. Auth: `const session = await getSession(); if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })`. Dynamic routes: `{ params }: { params: Promise<{ id: string }> }` then `await params`.
- Every data-access function starts with `await ensureSchema()` and uses `getPool().query(...)` (parameterized).
- Credits: reuse `deduct`/`refund`/`getBalance` from `@/lib/credits`; staff bypass via `isStaff(email)` from `@/lib/appLock` wraps BOTH pre-check and charge. Never widen `CreditReason` — autopilot charges use reason `'post'` with `metadata: { kind: 'autopilot' }`.
- Platforms: **X + Threads only** (`'x' | 'threads'`). LinkedIn does not exist in this codebase — `platforms` stays jsonb so it can be added later without migration.
- UI: real tokens are `electric-indigo` `#b06bff` (violet = manual), `cyber-lime` `#ADFF2F` (lime = autopilot), surfaces `surface-container-*`, text `on-surface`/`on-surface-variant`, border `border-muted`, error `error`. Fonts via semantic classes (`font-headline-xl text-headline-xl`, `font-body-md text-body-md`, `font-code-label text-code-label`). Icons = Material Symbols `<span className="material-symbols-outlined">name</span>`. NO toast library — inline messages / hand-rolled modals (pattern: `components/app/TopUpModal.tsx`). Buttons hand-rolled `rounded-full` like `DraftCard`. Dates formatted with native `toLocaleDateString`/`toLocaleTimeString` (NO date library).
- Product copy is user-facing (live product): short, lowercase-friendly, never leaks internals.
- Autopilot posts: NO CTA, NO URL, obey the voice spec (Task 3) — enforced by prompt AND a mechanical validator; empty/invalid output is refunded and skipped, never scheduled.
- Never hard-delete posts — `status='cancelled'`.
- Both cron routes gated by `Authorization: Bearer ${CRON_SECRET}`; publish logic callable per-single-post (future QStash swap).
- `export const maxDuration = 60` on cron + heavy routes (Hobby max per repo convention).
- Run `npm test` (vitest) and `npx tsc --noEmit` before each commit.

## Decisions locked with the user

- Vercel plan is **Hobby** → NO `vercel.json` crons. External trigger (cron-job.org primary, committed GitHub Actions workflow as fallback) hits the two protected routes.
- Scope: X + Threads. `first_reply` column + X reply-chaining are implemented in the publish executor (the "link in first reply" pattern), but no composer UI sets it yet — autopilot always leaves it NULL.
- `COST_PER_AUTO_POST = COST_PER_POST` (1 000), single constant in `lib/creditsConfig.ts`.
- Slot-match window: **±30 min** (`SLOT_WINDOW_MINUTES = 30`), used by BOTH the generation-cron occupancy check and the manual-schedule conflict rule.

---

### Task 1: Database schema + sync script

**Files:**
- Modify: `lib/db.ts` (append to `SCHEMA_SQL`, before the closing backtick at line 156)
- Modify: `db/schema.sql` (mirror the same DDL at the end)
- Modify: `lib/creditsConfig.ts` (add `COST_PER_AUTO_POST`)
- Create: `scripts/sync-schema.ts`

**Interfaces:**
- Produces: tables `scheduled_posts`, `autopilot_settings`, `notifications`; constant `COST_PER_AUTO_POST: number` exported from `@/lib/creditsConfig` (and re-exportable via `@/lib/credits` if needed — import from config directly in server code is also fine per house style `import { COST_PER_POST } from '@/lib/credits'`; use `@/lib/creditsConfig` in client components).

- [ ] **Step 1: Append DDL to `SCHEMA_SQL` in `lib/db.ts`**

Insert immediately before the final backtick (after the `threads_accounts` block):

```sql
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
```

- [ ] **Step 2: Mirror the same DDL at the end of `db/schema.sql`** (copy the block verbatim).

- [ ] **Step 3: Add the autopilot cost constant to `lib/creditsConfig.ts`**

After `export const COST_PER_POST = 1_000` (line 8):

```ts
// An autopilot-generated post costs the same as a manually generated one. ONE
// config constant so pricing changes in a single place (monetization spec §12).
export const COST_PER_AUTO_POST = COST_PER_POST
```

- [ ] **Step 4: Create `scripts/sync-schema.ts`**

```ts
// Apply SCHEMA_SQL to the database NOW. DB_SKIP_SCHEMA=1 (set in .env.local and
// prod) makes ensureSchema a no-op at runtime, so after ANY schema change this
// script must be run once per environment: `npx tsx scripts/sync-schema.ts`.
import { readFileSync } from 'node:fs'

// Load .env.local (no dotenv dependency): simple KEY=VALUE lines only.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  // no .env.local (CI / prod shell) — rely on the ambient environment
}
delete process.env.DB_SKIP_SCHEMA // force the DDL to actually run

const { ensureSchema, getPool } = await import('../lib/db')
await ensureSchema()
await getPool().end()
console.log('schema synced')
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Apply the schema to the dev database**

Run: `npx tsx scripts/sync-schema.ts`
Expected output: `schema synced`. Verify: `npx tsx -e "const{getPool}=await import('./lib/db');const r=await getPool().query(\"select table_name from information_schema.tables where table_name in ('scheduled_posts','autopilot_settings','notifications')\");console.log(r.rows);await getPool().end()"` prints all three table names. (Load env the same way if needed — simplest is to run after the sync script confirmed connectivity.)

> NOTE for prod rollout (final task): the same script must be run once with prod `DATABASE_URL` before/at deploy — never defer the migration (team antipattern).

- [ ] **Step 7: Commit**

```bash
git add lib/db.ts db/schema.sql lib/creditsConfig.ts scripts/sync-schema.ts
git commit -m "Add scheduling schema"
```

---

### Task 2: DST-safe slot math (`lib/schedule/slots.ts`)

**Files:**
- Create: `lib/schedule/slots.ts`
- Test: `lib/schedule/slots.test.ts`

**Interfaces:**
- Produces:
  - `SLOT_WINDOW_MINUTES = 30` (the shared slot-match window)
  - `zonedTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date` (m is 1-based)
  - `dateInTz(utc: Date, tz: string): { y: number; m: number; d: number }`
  - `isValidTimeZone(tz: string): boolean`
  - `type PostingTime = { time: string; days?: number[] }`
  - `type SlotConfig = { postingTimes: PostingTime[]; timezone: string; slotsPerDay: number }`
  - `upcomingSlots(cfg: SlotConfig, now: Date, horizonMinutes: number): Date[]`

- [ ] **Step 1: Write the failing tests** — `lib/schedule/slots.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { dateInTz, isValidTimeZone, upcomingSlots, zonedTimeToUtc } from './slots'

describe('zonedTimeToUtc', () => {
  it('converts fixed-offset zones (Asia/Almaty, UTC+5)', () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, 'Asia/Almaty').toISOString()).toBe('2026-01-15T04:00:00.000Z')
  })
  it('handles winter vs summer offsets (America/New_York)', () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, 'America/New_York').toISOString()).toBe('2026-01-15T14:00:00.000Z')
    expect(zonedTimeToUtc(2026, 7, 15, 9, 0, 'America/New_York').toISOString()).toBe('2026-07-15T13:00:00.000Z')
  })
  it('maps a nonexistent spring-forward time to a stable instant', () => {
    // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00→03:00).
    expect(zonedTimeToUtc(2026, 3, 8, 2, 30, 'America/New_York').toISOString()).toBe('2026-03-08T06:30:00.000Z')
  })
  it('picks the first occurrence of an ambiguous fall-back time', () => {
    // 2026-11-01 01:30 happens twice in New York; we take the EDT (first) one.
    expect(zonedTimeToUtc(2026, 11, 1, 1, 30, 'America/New_York').toISOString()).toBe('2026-11-01T05:30:00.000Z')
  })
})

describe('dateInTz', () => {
  it('returns the calendar date in the zone, not UTC', () => {
    // 2026-01-15T22:00Z is already Jan 16 in Almaty (UTC+5).
    expect(dateInTz(new Date('2026-01-15T22:00:00Z'), 'Asia/Almaty')).toEqual({ y: 2026, m: 1, d: 16 })
  })
})

describe('isValidTimeZone', () => {
  it('accepts real zones and rejects junk', () => {
    expect(isValidTimeZone('Asia/Almaty')).toBe(true)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
  })
})

describe('upcomingSlots', () => {
  const daily9 = { postingTimes: [{ time: '09:00' }], timezone: 'Asia/Almaty', slotsPerDay: 1 }

  it('returns the next slot inside the horizon', () => {
    // now = 07:00 local; 09:00 local = 04:00Z is 2h away, within 240 min.
    const slots = upcomingSlots(daily9, new Date('2026-01-15T02:00:00Z'), 240)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-15T04:00:00.000Z'])
  })

  it('excludes slots outside the horizon and in the past', () => {
    // now = 10:00 local — today's 09:00 has passed; tomorrow's is beyond 240 min.
    expect(upcomingSlots(daily9, new Date('2026-01-15T05:00:00Z'), 240)).toEqual([])
  })

  it('caps slots per day BEFORE filtering out past times', () => {
    // Two posting times but slotsPerDay=1: after 09:00 passes, 18:00 must NOT
    // become the day's slot — the day's quota was 09:00 only.
    const cfg = { postingTimes: [{ time: '09:00' }, { time: '18:00' }], timezone: 'Asia/Almaty', slotsPerDay: 1 }
    const slots = upcomingSlots(cfg, new Date('2026-01-15T05:00:00Z'), 2 * 1440)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-16T04:00:00.000Z', '2026-01-17T04:00:00.000Z'])
  })

  it('respects the days-of-week filter', () => {
    // 2026-01-15 is a Thursday (4). Mondays-only → next slot is Mon Jan 19.
    const cfg = { postingTimes: [{ time: '09:00', days: [1] }], timezone: 'Asia/Almaty', slotsPerDay: 1 }
    const slots = upcomingSlots(cfg, new Date('2026-01-15T02:00:00Z'), 7 * 1440)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-19T04:00:00.000Z'])
  })

  it('returns two slots per day when configured', () => {
    const cfg = { postingTimes: [{ time: '09:00' }, { time: '18:00' }], timezone: 'Asia/Almaty', slotsPerDay: 2 }
    const slots = upcomingSlots(cfg, new Date('2026-01-15T02:00:00Z'), 1440)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-15T04:00:00.000Z', '2026-01-15T13:00:00.000Z'])
  })

  it('ignores malformed time strings', () => {
    const cfg = { postingTimes: [{ time: 'garbage' }], timezone: 'Asia/Almaty', slotsPerDay: 1 }
    expect(upcomingSlots(cfg, new Date('2026-01-15T02:00:00Z'), 1440)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/schedule/slots.test.ts`
Expected: FAIL — cannot resolve `./slots`.

- [ ] **Step 3: Implement `lib/schedule/slots.ts`**

```ts
// Pure, DST-safe slot math. NO date library in this repo — everything is native
// Date + Intl. All returned instants are UTC Dates; wall-clock inputs carry an
// IANA timezone. Keep this file free of DB/IO so it stays unit-testable.

/** Manual-vs-autopilot slot match window (minutes). Used by BOTH the generation
 *  cron's occupancy check and the manual-schedule conflict rule (spec §7). */
export const SLOT_WINDOW_MINUTES = 30

export type PostingTime = { time: string; days?: number[] } // days: 0=Sunday..6; absent = every day
export type SlotConfig = { postingTimes: PostingTime[]; timezone: string; slotsPerDay: number }

/** Offset of `tz` from UTC at the instant `utc`, in ms (negative west of UTC). */
function tzOffsetMs(tz: string, utc: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
      .formatToParts(utc)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    parts.hour === '24' ? 0 : +parts.hour, +parts.minute, +parts.second,
  )
  return asUtc - utc.getTime()
}

/**
 * Wall-clock time in `tz` → UTC instant, DST-safe. `m` is 1-based. The second
 * offset lookup handles transitions: a nonexistent spring-forward time maps to
 * a stable nearby instant; an ambiguous fall-back time takes its first occurrence.
 */
export function zonedTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const naive = Date.UTC(y, m - 1, d, hh, mm)
  const first = tzOffsetMs(tz, new Date(naive))
  const offset = tzOffsetMs(tz, new Date(naive - first))
  return new Date(naive - offset)
}

/** The calendar date (y, m 1-based, d) that `utc` falls on in `tz`. */
export function dateInTz(utc: Date, tz: string): { y: number; m: number; d: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(utc)
      .map((p) => [p.type, p.value]),
  )
  return { y: +parts.year, m: +parts.month, d: +parts.day }
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const TIME_RE = /^(\d{2}):(\d{2})$/

/**
 * All slot instants in (now, now + horizonMinutes], honoring the per-day quota.
 * The quota is applied to the day's FULL slot list before dropping past times,
 * so a passed morning slot doesn't promote an evening time into the quota.
 */
export function upcomingSlots(cfg: SlotConfig, now: Date, horizonMinutes: number): Date[] {
  const end = now.getTime() + horizonMinutes * 60_000
  const out: Date[] = []
  const start = dateInTz(now, cfg.timezone)
  const days = Math.ceil(horizonMinutes / 1440) + 1
  for (let i = 0; i <= days; i++) {
    // Day arithmetic on the tz-local calendar date, via a UTC-noon anchor.
    const anchor = new Date(Date.UTC(start.y, start.m - 1, start.d + i))
    const y = anchor.getUTCFullYear()
    const m = anchor.getUTCMonth() + 1
    const d = anchor.getUTCDate()
    const weekday = anchor.getUTCDay() // weekday of a calendar date is tz-independent
    const daySlots: Date[] = []
    for (const pt of cfg.postingTimes) {
      const match = TIME_RE.exec(pt.time ?? '')
      if (!match) continue
      const hh = +match[1]
      const mm = +match[2]
      if (hh > 23 || mm > 59) continue
      if (pt.days && pt.days.length > 0 && !pt.days.includes(weekday)) continue
      daySlots.push(zonedTimeToUtc(y, m, d, hh, mm, cfg.timezone))
    }
    daySlots.sort((a, b) => a.getTime() - b.getTime())
    for (const t of daySlots.slice(0, Math.max(1, cfg.slotsPerDay))) {
      if (t.getTime() > now.getTime() && t.getTime() <= end) out.push(t)
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime())
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/schedule/slots.test.ts`
Expected: all tests PASS. If the two DST-edge assertions disagree with the implementation by exactly one hour, verify the expected instants by hand (`TZ=America/New_York node -e "..."`) and fix the TEST only if the implementation's mapping is internally consistent (nonexistent time → stable instant, ambiguous → first occurrence).

- [ ] **Step 5: Commit**

```bash
git add lib/schedule/slots.ts lib/schedule/slots.test.ts
git commit -m "Add slot math"
```

---

### Task 3: Autopilot voice-spec prompt + output validator

**Files:**
- Create: `outloud-autopilot-prompt.md`
- Modify: `scripts/build-prompt.mjs` (register the artifact)
- Create: `lib/autopilot/validate.ts`
- Test: `lib/autopilot/validate.test.ts`
- Generated (by the build script — do not hand-edit): `lib/autopilotPrompt.ts`

**Interfaces:**
- Produces: `AUTOPILOT_PROMPT: string` from `@/lib/autopilotPrompt` (passed as `formatText` into the existing `generatePost`), `validateAutopilotPost(text: string, maxLen?: number): { ok: boolean; reason?: string }` from `@/lib/autopilot/validate`.

- [ ] **Step 1: Create `outloud-autopilot-prompt.md`** (voice spec §9, injected verbatim into every autopilot generation as the FORMAT text)

```markdown
<!--
Autopilot FORMAT prompt. Bundled to lib/autopilotPrompt.ts by scripts/build-prompt.mjs
(run `npm run gen:prompt` after editing). Passed as formatText into generatePost for
every autopilot generation — it rides on top of BASE_PROMPT + the user's voice block.
Autopilot content is audience-building: no CTA, no URL, ever.
-->
FORMAT: autopilot audience post (X-length, single post).

this post is written on autopilot to build the author's audience. every rule below is mandatory and overrides any conflicting instinct:

- all lowercase. no capital letters anywhere, including "i" and names.
- additive sentences chained with and / but / so.
- no em-dashes.
- no rule-of-three lists.
- no "it's not X, it's Y" constructions.
- no tidy aphoristic closers.
- age-, location-, and ethnicity-neutral: never reference the author's age, schooling, nationality, city, or any language other than english.
- no call to action of any kind. do not ask readers to follow, reply, share, click, or do anything.
- no link and no url in the post body.
- one single post, under 280 characters.

write about the given interest area from the author's lived point of view, in their voice.
```

- [ ] **Step 2: Register the artifact in `scripts/build-prompt.mjs`**

Add to the `ARTIFACTS` array:

```js
  { md: 'outloud-autopilot-prompt.md', ts: 'lib/autopilotPrompt.ts', name: 'AUTOPILOT_PROMPT' },
```

Run: `npm run gen:prompt`
Expected output includes: `wrote lib/autopilotPrompt.ts (N chars)`.

- [ ] **Step 3: Write the failing validator tests** — `lib/autopilot/validate.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { validateAutopilotPost } from './validate'

describe('validateAutopilotPost', () => {
  it('accepts a compliant lowercase post', () => {
    expect(validateAutopilotPost('shipped a tiny fix today and it took three hours but the bug taught me more than the feature did')).toEqual({ ok: true })
  })
  it('rejects empty or whitespace-only output', () => {
    expect(validateAutopilotPost('')).toEqual({ ok: false, reason: 'empty' })
    expect(validateAutopilotPost('   \n ')).toEqual({ ok: false, reason: 'empty' })
  })
  it('rejects uppercase letters', () => {
    expect(validateAutopilotPost('Shipped a fix today')).toEqual({ ok: false, reason: 'uppercase' })
  })
  it('rejects em-dashes', () => {
    expect(validateAutopilotPost('shipped a fix — finally')).toEqual({ ok: false, reason: 'em-dash' })
  })
  it('rejects urls anywhere in the body', () => {
    expect(validateAutopilotPost('read more at https://example.com')).toEqual({ ok: false, reason: 'url' })
    expect(validateAutopilotPost('see www.example.com for details')).toEqual({ ok: false, reason: 'url' })
  })
  it('rejects posts over the platform cap', () => {
    expect(validateAutopilotPost('a'.repeat(281))).toEqual({ ok: false, reason: 'too-long' })
    expect(validateAutopilotPost('a'.repeat(280))).toEqual({ ok: true })
  })
})
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run lib/autopilot/validate.test.ts`
Expected: FAIL — cannot resolve `./validate`.

- [ ] **Step 5: Implement `lib/autopilot/validate.ts`**

```ts
// Mechanical safety net over the autopilot FORMAT prompt (voice spec): an
// autopilot post that violates these is refunded and skipped, NEVER scheduled.
// Style rules the model must judge (rule-of-three, aphorisms) live in the
// prompt; only mechanically checkable rules are enforced here.

const URL_RE = /https?:\/\/|www\./i

export function validateAutopilotPost(text: string, maxLen = 280): { ok: boolean; reason?: string } {
  const t = (text ?? '').trim()
  if (!t) return { ok: false, reason: 'empty' }
  if (t !== t.toLowerCase()) return { ok: false, reason: 'uppercase' }
  if (t.includes('—')) return { ok: false, reason: 'em-dash' }
  if (URL_RE.test(t)) return { ok: false, reason: 'url' }
  if (t.length > maxLen) return { ok: false, reason: 'too-long' }
  return { ok: true }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/autopilot/validate.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add outloud-autopilot-prompt.md scripts/build-prompt.mjs lib/autopilotPrompt.ts lib/autopilot/validate.ts lib/autopilot/validate.test.ts
git commit -m "Add autopilot prompt validator"
```

### Task 4: Scheduled-posts store (`lib/schedule/store.ts` + types)

**Files:**
- Create: `lib/schedule/types.ts`
- Create: `lib/schedule/store.ts`

**Interfaces:**
- Consumes: `ensureSchema`, `getPool` from `@/lib/db`; `randomUUID` from `node:crypto`.
- Produces (used by Tasks 5–14):
  - types: `SchedulePlatform = 'x' | 'threads'`, `ScheduledPostStatus`, `ScheduledPostSource`, `ScheduledMedia = { url: string; alt?: string }`, `ExternalPostIds = Partial<Record<SchedulePlatform, string>>`, `ScheduledPost`
  - `createScheduledPost(input: CreateScheduledPostInput): Promise<ScheduledPost>`
  - `listScheduledPosts(userId: string, from: Date, to: Date): Promise<ScheduledPost[]>`
  - `listUpcomingAutopilot(userId: string, limit?: number): Promise<ScheduledPost[]>`
  - `getScheduledPost(userId: string, id: string): Promise<ScheduledPost | null>`
  - `updateScheduledPost(userId: string, id: string, patch: ScheduledPostPatch): Promise<ScheduledPost | null>` (only `draft`/`scheduled` rows; returns null otherwise)
  - `cancelScheduledPost(userId: string, id: string): Promise<ScheduledPost | null>` (only not-yet-publishing rows)
  - `findPendingAutopilotInSlot(userId: string, slot: Date, windowMin: number): Promise<ScheduledPost[]>`
  - `isSlotOccupied(userId: string, slot: Date, windowMin: number): Promise<boolean>`
  - `listDuePostIds(limit: number): Promise<string[]>`
  - `claimForPublishing(id: string): Promise<ScheduledPost | null>` (atomic `status='scheduled'→'publishing'` claim)
  - `finishPublish(id: string, outcome: PublishOutcome): Promise<void>`

- [ ] **Step 1: Create `lib/schedule/types.ts`**

```ts
// The ONE calendar's row shape. Manual and autopilot posts share this table —
// there are no separate modes, just two sources feeding the same calendar.

export type SchedulePlatform = 'x' | 'threads'
export type ScheduledPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'
export type ScheduledPostSource = 'manual' | 'autopilot'
export type ScheduledMedia = { url: string; alt?: string }
export type ExternalPostIds = Partial<Record<SchedulePlatform, string>>

export type ScheduledPost = {
  id: string
  userId: string
  content: string
  firstReply: string | null
  platforms: SchedulePlatform[]
  media: ScheduledMedia[] | null
  scheduledFor: string // ISO, UTC
  timezone: string // IANA, for display + slot math
  status: ScheduledPostStatus
  source: ScheduledPostSource
  externalPostIds: ExternalPostIds | null
  error: string | null
  retryCount: number
  creditsCharged: number
  chargeLedgerId: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export const SCHEDULE_PLATFORMS: SchedulePlatform[] = ['x', 'threads']

export function isSchedulePlatform(v: unknown): v is SchedulePlatform {
  return v === 'x' || v === 'threads'
}
```

- [ ] **Step 2: Create `lib/schedule/store.ts`**

```ts
import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'
import type {
  ExternalPostIds,
  ScheduledMedia,
  ScheduledPost,
  ScheduledPostSource,
  ScheduledPostStatus,
  SchedulePlatform,
} from './types'

type Row = {
  id: string
  user_id: string
  content: string
  first_reply: string | null
  platforms: SchedulePlatform[]
  media: ScheduledMedia[] | null
  scheduled_for: Date
  timezone: string
  status: ScheduledPostStatus
  source: ScheduledPostSource
  external_post_ids: ExternalPostIds | null
  error: string | null
  retry_count: number
  credits_charged: number
  charge_ledger_id: string | null
  created_at: Date
  updated_at: Date
  published_at: Date | null
}

function mapRow(r: Row): ScheduledPost {
  return {
    id: r.id,
    userId: r.user_id,
    content: r.content,
    firstReply: r.first_reply,
    platforms: r.platforms ?? [],
    media: r.media,
    scheduledFor: r.scheduled_for.toISOString(),
    timezone: r.timezone,
    status: r.status,
    source: r.source,
    externalPostIds: r.external_post_ids,
    error: r.error,
    retryCount: r.retry_count,
    creditsCharged: r.credits_charged,
    chargeLedgerId: r.charge_ledger_id,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
  }
}

export type CreateScheduledPostInput = {
  userId: string
  content: string
  firstReply?: string | null
  platforms: SchedulePlatform[]
  media?: ScheduledMedia[] | null
  scheduledFor: Date
  timezone: string
  source: ScheduledPostSource
  creditsCharged?: number
  chargeLedgerId?: string | null
}

export async function createScheduledPost(input: CreateScheduledPostInput): Promise<ScheduledPost> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `INSERT INTO scheduled_posts
       (id, user_id, content, first_reply, platforms, media, scheduled_for, timezone,
        status, source, credits_charged, charge_ledger_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,$10,$11)
     RETURNING *`,
    [
      randomUUID(),
      input.userId,
      input.content,
      input.firstReply ?? null,
      JSON.stringify(input.platforms),
      input.media && input.media.length ? JSON.stringify(input.media) : null,
      input.scheduledFor,
      input.timezone,
      input.source,
      input.creditsCharged ?? 0,
      input.chargeLedgerId ?? null,
    ],
  )
  return mapRow(r.rows[0])
}

/** Calendar range read. Cancelled posts are hidden from the calendar. */
export async function listScheduledPosts(userId: string, from: Date, to: Date): Promise<ScheduledPost[]> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `SELECT * FROM scheduled_posts
     WHERE user_id = $1 AND scheduled_for >= $2 AND scheduled_for < $3 AND status <> 'cancelled'
     ORDER BY scheduled_for`,
    [userId, from, to],
  )
  return r.rows.map(mapRow)
}

/** The next queued autopilot posts, for the Autopilot settings page. */
export async function listUpcomingAutopilot(userId: string, limit = 5): Promise<ScheduledPost[]> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `SELECT * FROM scheduled_posts
     WHERE user_id = $1 AND source = 'autopilot' AND status = 'scheduled' AND scheduled_for > now()
     ORDER BY scheduled_for LIMIT $2`,
    [userId, limit],
  )
  return r.rows.map(mapRow)
}

export async function getScheduledPost(userId: string, id: string): Promise<ScheduledPost | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(`SELECT * FROM scheduled_posts WHERE user_id = $1 AND id = $2`, [userId, id])
  return r.rows[0] ? mapRow(r.rows[0]) : null
}

export type ScheduledPostPatch = {
  content?: string
  firstReply?: string | null
  platforms?: SchedulePlatform[]
  media?: ScheduledMedia[] | null
  scheduledFor?: Date
  timezone?: string
}

/** Edit a not-yet-fired post. The status guard is IN the SQL so a post that
 *  starts publishing between read and write can't be edited (spec §11). */
export async function updateScheduledPost(userId: string, id: string, patch: ScheduledPostPatch): Promise<ScheduledPost | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `UPDATE scheduled_posts SET
       content        = COALESCE($3, content),
       first_reply    = CASE WHEN $4::boolean THEN $5 ELSE first_reply END,
       platforms      = COALESCE($6, platforms),
       media          = CASE WHEN $7::boolean THEN $8 ELSE media END,
       scheduled_for  = COALESCE($9, scheduled_for),
       timezone       = COALESCE($10, timezone),
       updated_at     = now()
     WHERE user_id = $1 AND id = $2 AND status IN ('draft','scheduled')
     RETURNING *`,
    [
      userId,
      id,
      patch.content ?? null,
      patch.firstReply !== undefined,
      patch.firstReply ?? null,
      patch.platforms ? JSON.stringify(patch.platforms) : null,
      patch.media !== undefined,
      patch.media && patch.media.length ? JSON.stringify(patch.media) : null,
      patch.scheduledFor ?? null,
      patch.timezone ?? null,
    ],
  )
  return r.rows[0] ? mapRow(r.rows[0]) : null
}

/** Soft-cancel (never hard-delete). Only rows that haven't started publishing. */
export async function cancelScheduledPost(userId: string, id: string): Promise<ScheduledPost | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `UPDATE scheduled_posts SET status = 'cancelled', updated_at = now()
     WHERE user_id = $1 AND id = $2 AND status IN ('draft','scheduled','failed')
     RETURNING *`,
    [userId, id],
  )
  return r.rows[0] ? mapRow(r.rows[0]) : null
}

/** Pending autopilot posts sitting in a slot window — the ones "manual wins" evicts. */
export async function findPendingAutopilotInSlot(userId: string, slot: Date, windowMin: number): Promise<ScheduledPost[]> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `SELECT * FROM scheduled_posts
     WHERE user_id = $1 AND source = 'autopilot' AND status = 'scheduled'
       AND scheduled_for > $2::timestamptz - make_interval(mins => $3)
       AND scheduled_for < $2::timestamptz + make_interval(mins => $3)`,
    [userId, slot, windowMin],
  )
  return r.rows.map(mapRow)
}

/** Occupancy for the generation cron: ANY non-cancelled post near the slot blocks it. */
export async function isSlotOccupied(userId: string, slot: Date, windowMin: number): Promise<boolean> {
  await ensureSchema()
  const r = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM scheduled_posts
     WHERE user_id = $1 AND status <> 'cancelled'
       AND scheduled_for > $2::timestamptz - make_interval(mins => $3)
       AND scheduled_for < $2::timestamptz + make_interval(mins => $3)`,
    [userId, slot, windowMin],
  )
  return Number(r.rows[0]?.n ?? '0') > 0
}

/** Due posts for the publish cron scan. */
export async function listDuePostIds(limit: number): Promise<string[]> {
  await ensureSchema()
  const r = await getPool().query<{ id: string }>(
    `SELECT id FROM scheduled_posts
     WHERE status = 'scheduled' AND scheduled_for <= now()
     ORDER BY scheduled_for LIMIT $1`,
    [limit],
  )
  return r.rows.map((x) => x.id)
}

/** Atomic claim — the double-publish guard (spec §6b). Succeeds for exactly one
 *  caller; a second concurrent cron run gets null and must skip the post. */
export async function claimForPublishing(id: string): Promise<ScheduledPost | null> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `UPDATE scheduled_posts SET status = 'publishing', updated_at = now()
     WHERE id = $1 AND status = 'scheduled'
     RETURNING *`,
    [id],
  )
  return r.rows[0] ? mapRow(r.rows[0]) : null
}

export type PublishOutcome = {
  status: 'published' | 'scheduled' | 'failed' // 'scheduled' = requeued for retry
  externalPostIds: ExternalPostIds
  error: string | null
  retryCount: number
}

export async function finishPublish(id: string, outcome: PublishOutcome): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE scheduled_posts SET
       status = $2,
       external_post_ids = $3,
       error = $4,
       retry_count = $5,
       published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
       updated_at = now()
     WHERE id = $1`,
    [id, outcome.status, JSON.stringify(outcome.externalPostIds), outcome.error, outcome.retryCount],
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/schedule/types.ts lib/schedule/store.ts
git commit -m "Add scheduled posts store"
```

---

### Task 5: Autopilot-settings store, notifications store, conflict rule

**Files:**
- Create: `lib/autopilot/store.ts`
- Create: `lib/notifications/store.ts`
- Create: `lib/schedule/conflict.ts`

**Interfaces:**
- Consumes: Task 4 store, `refund` from `@/lib/credits`, `SLOT_WINDOW_MINUTES` from `./slots`.
- Produces:
  - `AutopilotSettings` type + `getAutopilotSettings(userId): Promise<AutopilotSettings>` (returns defaults row if none), `upsertAutopilotSettings(userId, patch): Promise<AutopilotSettings>`, `pauseAutopilot(userId, reason): Promise<void>`, `resumeAutopilot(userId): Promise<void>`, `listAutopilotCandidates(): Promise<AutopilotCandidate[]>`
  - `AppNotification` type + `addNotification(input): Promise<void>`, `listNotifications(userId, limit?): Promise<AppNotification[]>`, `unreadCount(userId): Promise<number>`, `markAllRead(userId): Promise<void>`
  - `releaseSlotForManual(userId: string, slot: Date): Promise<number>` and `slotOccupied(userId: string, slot: Date): Promise<boolean>` from `@/lib/schedule/conflict`

- [ ] **Step 1: Create `lib/autopilot/store.ts`**

```ts
import { ensureSchema, getPool } from '@/lib/db'
import type { SchedulePlatform } from '@/lib/schedule/types'
import type { PostingTime } from '@/lib/schedule/slots'

export type AutopilotSettings = {
  userId: string
  enabled: boolean
  interests: string[]
  postingTimes: PostingTime[]
  timezone: string
  platforms: SchedulePlatform[]
  reviewBeforePublish: boolean
  slotsPerDay: number
  leadTimeMinutes: number
  pausedAt: string | null
  pauseReason: string | null
}

type Row = {
  user_id: string
  enabled: boolean
  interests: string[]
  posting_times: PostingTime[]
  timezone: string
  platforms: SchedulePlatform[]
  review_before_publish: boolean
  slots_per_day: number
  lead_time_minutes: number
  paused_at: Date | null
  pause_reason: string | null
}

function mapRow(r: Row): AutopilotSettings {
  return {
    userId: r.user_id,
    enabled: r.enabled,
    interests: r.interests ?? [],
    postingTimes: r.posting_times ?? [],
    timezone: r.timezone,
    platforms: r.platforms ?? [],
    reviewBeforePublish: r.review_before_publish,
    slotsPerDay: r.slots_per_day,
    leadTimeMinutes: r.lead_time_minutes,
    pausedAt: r.paused_at ? r.paused_at.toISOString() : null,
    pauseReason: r.pause_reason,
  }
}

function defaults(userId: string): AutopilotSettings {
  return {
    userId,
    enabled: false,
    interests: [],
    postingTimes: [],
    timezone: 'UTC',
    platforms: [],
    reviewBeforePublish: true,
    slotsPerDay: 1,
    leadTimeMinutes: 240,
    pausedAt: null,
    pauseReason: null,
  }
}

export async function getAutopilotSettings(userId: string): Promise<AutopilotSettings> {
  await ensureSchema()
  const r = await getPool().query<Row>(`SELECT * FROM autopilot_settings WHERE user_id = $1`, [userId])
  return r.rows[0] ? mapRow(r.rows[0]) : defaults(userId)
}

export type AutopilotSettingsPatch = Partial<
  Pick<AutopilotSettings, 'enabled' | 'interests' | 'postingTimes' | 'timezone' | 'platforms' | 'reviewBeforePublish' | 'slotsPerDay' | 'leadTimeMinutes'>
>

export async function upsertAutopilotSettings(userId: string, patch: AutopilotSettingsPatch): Promise<AutopilotSettings> {
  await ensureSchema()
  const cur = await getAutopilotSettings(userId)
  const next = { ...cur, ...patch }
  const r = await getPool().query<Row>(
    `INSERT INTO autopilot_settings
       (user_id, enabled, interests, posting_times, timezone, platforms,
        review_before_publish, slots_per_day, lead_time_minutes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (user_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       interests = EXCLUDED.interests,
       posting_times = EXCLUDED.posting_times,
       timezone = EXCLUDED.timezone,
       platforms = EXCLUDED.platforms,
       review_before_publish = EXCLUDED.review_before_publish,
       slots_per_day = EXCLUDED.slots_per_day,
       lead_time_minutes = EXCLUDED.lead_time_minutes,
       updated_at = now()
     RETURNING *`,
    [
      userId,
      next.enabled,
      JSON.stringify(next.interests),
      JSON.stringify(next.postingTimes),
      next.timezone,
      JSON.stringify(next.platforms),
      next.reviewBeforePublish,
      next.slotsPerDay,
      next.leadTimeMinutes,
    ],
  )
  return mapRow(r.rows[0])
}

export async function pauseAutopilot(userId: string, reason: string): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE autopilot_settings SET paused_at = now(), pause_reason = $2, updated_at = now() WHERE user_id = $1`,
    [userId, reason],
  )
}

export async function resumeAutopilot(userId: string): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `UPDATE autopilot_settings SET paused_at = NULL, pause_reason = NULL, updated_at = now() WHERE user_id = $1`,
    [userId],
  )
}

export type AutopilotCandidate = { settings: AutopilotSettings; email: string }

/** Users the generation cron should serve: enabled and not paused. Email is
 *  joined in for the isStaff() unlimited-credits bypass. */
export async function listAutopilotCandidates(): Promise<AutopilotCandidate[]> {
  await ensureSchema()
  const r = await getPool().query<Row & { email: string }>(
    `SELECT a.*, u.email FROM autopilot_settings a
     JOIN users u ON u.id = a.user_id
     WHERE a.enabled AND a.paused_at IS NULL
     ORDER BY a.updated_at`,
  )
  return r.rows.map((row) => ({ settings: mapRow(row), email: row.email }))
}
```

- [ ] **Step 2: Create `lib/notifications/store.ts`**

```ts
import { randomUUID } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'

// Lightweight in-app notifications (spec §8) — a table + a bell, no heavy system.
export type NotificationKind = 'autopilot_queued' | 'autopilot_paused' | 'publish_failed'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  refId: string | null
  readAt: string | null
  createdAt: string
}

type Row = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  ref_id: string | null
  read_at: Date | null
  created_at: Date
}

const mapRow = (r: Row): AppNotification => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  refId: r.ref_id,
  readAt: r.read_at ? r.read_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
})

export async function addNotification(input: {
  userId: string
  kind: NotificationKind
  title: string
  body?: string
  refId?: string
}): Promise<void> {
  await ensureSchema()
  await getPool().query(
    `INSERT INTO notifications (id, user_id, kind, title, body, ref_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), input.userId, input.kind, input.title, input.body ?? null, input.refId ?? null],
  )
}

export async function listNotifications(userId: string, limit = 20): Promise<AppNotification[]> {
  await ensureSchema()
  const r = await getPool().query<Row>(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  )
  return r.rows.map(mapRow)
}

export async function unreadCount(userId: string): Promise<number> {
  await ensureSchema()
  const r = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  )
  return Number(r.rows[0]?.n ?? '0')
}

export async function markAllRead(userId: string): Promise<void> {
  await ensureSchema()
  await getPool().query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId])
}
```

- [ ] **Step 3: Create `lib/schedule/conflict.ts`** — the ONE shared slot-occupancy/conflict seam (spec §7)

```ts
import { refund } from '@/lib/credits'
import { SLOT_WINDOW_MINUTES } from './slots'
import { cancelScheduledPost, findPendingAutopilotInSlot, isSlotOccupied } from './store'

/**
 * Manual wins (spec §7): before placing a manual post into a slot, cancel any
 * PENDING autopilot post occupying it (±SLOT_WINDOW_MINUTES) and refund its
 * unpublished charge. Returns how many autopilot posts were evicted.
 */
export async function releaseSlotForManual(userId: string, slot: Date): Promise<number> {
  const pending = await findPendingAutopilotInSlot(userId, slot, SLOT_WINDOW_MINUTES)
  let evicted = 0
  for (const p of pending) {
    const cancelled = await cancelScheduledPost(userId, p.id)
    if (!cancelled) continue // raced into publishing — leave it alone
    evicted++
    if (p.chargeLedgerId && p.creditsCharged > 0 && !p.publishedAt) {
      await refund(userId, p.chargeLedgerId).catch((e) => console.error('[schedule/conflict] refund failed:', e))
    }
  }
  return evicted
}

/** Generation-cron side of the same rule: ANY non-cancelled post near the slot
 *  (manual OR autopilot) blocks autopilot from filling it. Same window. */
export async function slotOccupied(userId: string, slot: Date): Promise<boolean> {
  return isSlotOccupied(userId, slot, SLOT_WINDOW_MINUTES)
}
```

- [ ] **Step 4: Typecheck + run existing tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean typecheck; all vitest suites pass.

- [ ] **Step 5: Commit**

```bash
git add lib/autopilot/store.ts lib/notifications/store.ts lib/schedule/conflict.ts
git commit -m "Add autopilot notification stores"
```

---

### Task 6: API — scheduled posts CRUD with the conflict rule

**Files:**
- Create: `app/api/scheduled-posts/route.ts` (POST create + GET range list)
- Create: `app/api/scheduled-posts/[id]/route.ts` (PATCH edit + DELETE cancel)

**Interfaces:**
- Consumes: Task 4 store, Task 5 `releaseSlotForManual`, `isValidTimeZone` from `@/lib/schedule/slots`, `isSchedulePlatform` from `@/lib/schedule/types`, `refund` from `@/lib/credits`.
- Produces HTTP API (client fetches in Tasks 8, 9):
  - `POST /api/scheduled-posts` body `{ content, firstReply?, platforms, media?, scheduledFor, timezone }` → `{ post, evicted }` (201)
  - `GET /api/scheduled-posts?from=ISO&to=ISO` → `{ posts }`
  - `PATCH /api/scheduled-posts/:id` body subset `{ content?, scheduledFor?, timezone?, platforms?, media? }` → `{ post }`; 409 `{ error }` if already publishing/published
  - `DELETE /api/scheduled-posts/:id` → `{ post }` (cancelled); 409 if not cancellable

- [ ] **Step 1: Create `app/api/scheduled-posts/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { releaseSlotForManual } from '@/lib/schedule/conflict'
import { isValidTimeZone } from '@/lib/schedule/slots'
import { createScheduledPost, listScheduledPosts } from '@/lib/schedule/store'
import { isSchedulePlatform, type ScheduledMedia, type SchedulePlatform } from '@/lib/schedule/types'

const TEXT_MAX = 25000 // matches the X publish route ceiling
const RANGE_MAX_DAYS = 100

export function parsePlatforms(raw: unknown): SchedulePlatform[] | null {
  if (!Array.isArray(raw)) return null
  const out = [...new Set(raw.filter(isSchedulePlatform))]
  return out.length ? out : null
}

export function parseMedia(raw: unknown): ScheduledMedia[] | null {
  if (!Array.isArray(raw)) return null
  const out: ScheduledMedia[] = []
  for (const m of raw.slice(0, 4)) {
    if (m && typeof m === 'object' && typeof (m as { url?: unknown }).url === 'string') {
      const alt = (m as { alt?: unknown }).alt
      out.push({ url: (m as { url: string }).url, ...(typeof alt === 'string' ? { alt } : {}) })
    }
  }
  return out.length ? out : null
}

// POST /api/scheduled-posts — place a manual post on the calendar. Manual wins:
// a pending autopilot post in the same slot is cancelled (+ refunded) first.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>

  const content = typeof b.content === 'string' ? b.content.trim() : ''
  if (!content) return NextResponse.json({ error: 'Nothing to schedule.' }, { status: 400 })
  if (content.length > TEXT_MAX) return NextResponse.json({ error: 'That post is too long.' }, { status: 400 })

  const platforms = parsePlatforms(b.platforms)
  if (!platforms) return NextResponse.json({ error: 'Pick at least one platform.' }, { status: 400 })

  const scheduledFor = typeof b.scheduledFor === 'string' ? new Date(b.scheduledFor) : null
  if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }
  if (scheduledFor.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Pick a time in the future.' }, { status: 400 })
  }

  const timezone = typeof b.timezone === 'string' ? b.timezone : ''
  if (!isValidTimeZone(timezone)) return NextResponse.json({ error: 'Invalid timezone.' }, { status: 400 })

  const firstReply = typeof b.firstReply === 'string' && b.firstReply.trim() ? b.firstReply.trim().slice(0, TEXT_MAX) : null
  const media = parseMedia(b.media)

  try {
    const evicted = await releaseSlotForManual(session.userId, scheduledFor)
    const post = await createScheduledPost({
      userId: session.userId,
      content,
      firstReply,
      platforms,
      media,
      scheduledFor,
      timezone,
      source: 'manual',
    })
    return NextResponse.json({ post, evicted }, { status: 201 })
  } catch (err) {
    console.error('[scheduled-posts] create failed:', err)
    return NextResponse.json({ error: 'Could not schedule that. Try again.' }, { status: 500 })
  }
}

// GET /api/scheduled-posts?from=&to= — calendar range read.
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const url = new URL(req.url)
  const from = new Date(url.searchParams.get('from') ?? '')
  const to = new Date(url.searchParams.get('to') ?? '')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'Invalid range.' }, { status: 400 })
  }
  if (to.getTime() - from.getTime() > RANGE_MAX_DAYS * 86_400_000) {
    return NextResponse.json({ error: 'Range too large.' }, { status: 400 })
  }

  try {
    const posts = await listScheduledPosts(session.userId, from, to)
    return NextResponse.json({ posts })
  } catch (err) {
    console.error('[scheduled-posts] list failed:', err)
    return NextResponse.json({ error: 'Could not load the calendar. Try again.' }, { status: 500 })
  }
}
```

> NOTE: `parsePlatforms`/`parseMedia` are exported for reuse by the `[id]` route. Next.js route files may only export HTTP verbs + config — **move these two helpers into `lib/schedule/parse.ts` instead** and import them in both route files. Create `lib/schedule/parse.ts` with exactly those two functions (same code, plus the `ScheduledMedia`/`SchedulePlatform` imports), and keep the route files free of extra exports.

- [ ] **Step 2: Create `lib/schedule/parse.ts`** (as per the note above)

```ts
import { isSchedulePlatform, type ScheduledMedia, type SchedulePlatform } from './types'

/** Body → validated platform list (deduped). Null = invalid/empty. */
export function parsePlatforms(raw: unknown): SchedulePlatform[] | null {
  if (!Array.isArray(raw)) return null
  const out = [...new Set(raw.filter(isSchedulePlatform))]
  return out.length ? out : null
}

/** Body → up to 4 validated media refs. Null = none. */
export function parseMedia(raw: unknown): ScheduledMedia[] | null {
  if (!Array.isArray(raw)) return null
  const out: ScheduledMedia[] = []
  for (const m of raw.slice(0, 4)) {
    if (m && typeof m === 'object' && typeof (m as { url?: unknown }).url === 'string') {
      const alt = (m as { alt?: unknown }).alt
      out.push({ url: (m as { url: string }).url, ...(typeof alt === 'string' ? { alt } : {}) })
    }
  }
  return out.length ? out : null
}
```

(and in `app/api/scheduled-posts/route.ts` replace the inline definitions with `import { parseMedia, parsePlatforms } from '@/lib/schedule/parse'`.)

- [ ] **Step 3: Create `app/api/scheduled-posts/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { refund } from '@/lib/credits'
import { releaseSlotForManual } from '@/lib/schedule/conflict'
import { parseMedia, parsePlatforms } from '@/lib/schedule/parse'
import { isValidTimeZone } from '@/lib/schedule/slots'
import { cancelScheduledPost, getScheduledPost, updateScheduledPost, type ScheduledPostPatch } from '@/lib/schedule/store'

type Ctx = { params: Promise<{ id: string }> }
const TEXT_MAX = 25000

// PATCH /api/scheduled-posts/[id] — edit a draft/scheduled post before it fires.
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>

  const patch: ScheduledPostPatch = {}
  if (typeof b.content === 'string') {
    const content = b.content.trim()
    if (!content) return NextResponse.json({ error: 'Post text cannot be empty.' }, { status: 400 })
    if (content.length > TEXT_MAX) return NextResponse.json({ error: 'That post is too long.' }, { status: 400 })
    patch.content = content
  }
  if (b.firstReply !== undefined) {
    patch.firstReply = typeof b.firstReply === 'string' && b.firstReply.trim() ? b.firstReply.trim().slice(0, TEXT_MAX) : null
  }
  if (b.platforms !== undefined) {
    const platforms = parsePlatforms(b.platforms)
    if (!platforms) return NextResponse.json({ error: 'Pick at least one platform.' }, { status: 400 })
    patch.platforms = platforms
  }
  if (b.media !== undefined) patch.media = parseMedia(b.media)
  if (b.scheduledFor !== undefined) {
    const when = typeof b.scheduledFor === 'string' ? new Date(b.scheduledFor) : null
    if (!when || Number.isNaN(when.getTime())) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
    if (when.getTime() <= Date.now()) return NextResponse.json({ error: 'Pick a time in the future.' }, { status: 400 })
    patch.scheduledFor = when
  }
  if (b.timezone !== undefined) {
    if (typeof b.timezone !== 'string' || !isValidTimeZone(b.timezone)) {
      return NextResponse.json({ error: 'Invalid timezone.' }, { status: 400 })
    }
    patch.timezone = b.timezone
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  try {
    // Moving a MANUAL post into a new slot also wins over pending autopilot there.
    if (patch.scheduledFor) {
      const existing = await getScheduledPost(session.userId, id)
      if (existing?.source === 'manual') await releaseSlotForManual(session.userId, patch.scheduledFor)
    }
    const post = await updateScheduledPost(session.userId, id, patch)
    if (!post) {
      const existing = await getScheduledPost(session.userId, id)
      if (!existing) return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
      return NextResponse.json({ error: 'This post is already publishing and can no longer be edited.' }, { status: 409 })
    }
    return NextResponse.json({ post })
  } catch (err) {
    console.error('[scheduled-posts] update failed:', err)
    return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 })
  }
}

// DELETE /api/scheduled-posts/[id] — cancel (soft), refunding an unpublished
// autopilot charge. Never hard-deletes.
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  try {
    const post = await cancelScheduledPost(session.userId, id)
    if (!post) {
      const existing = await getScheduledPost(session.userId, id)
      if (!existing) return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
      return NextResponse.json({ error: 'This post is already publishing and can no longer be cancelled.' }, { status: 409 })
    }
    if (post.chargeLedgerId && post.creditsCharged > 0 && !post.publishedAt) {
      await refund(session.userId, post.chargeLedgerId).catch((e) => console.error('[scheduled-posts] refund failed:', e))
    }
    return NextResponse.json({ post })
  } catch (err) {
    console.error('[scheduled-posts] cancel failed:', err)
    return NextResponse.json({ error: 'Could not cancel that. Try again.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Smoke-test the endpoints against the dev server**

Run: `npm run dev` in the background, sign in in a browser to grab the `outloud_session` cookie, then:

```bash
COOKIE='outloud_session=<paste>'
curl -s -X POST localhost:3000/api/scheduled-posts -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d '{"content":"test scheduled post","platforms":["x"],"scheduledFor":"2026-07-06T09:00:00Z","timezone":"Asia/Almaty"}'
curl -s "localhost:3000/api/scheduled-posts?from=2026-07-01T00:00:00Z&to=2026-08-01T00:00:00Z" -H "Cookie: $COOKIE"
```

Expected: 201 with `{ post: { id, status: "scheduled", source: "manual", ... }, evicted: 0 }`; the GET returns it. Then PATCH the content and DELETE it; confirm DELETE returns `status: "cancelled"`.

- [ ] **Step 6: Commit**

```bash
git add app/api/scheduled-posts lib/schedule/parse.ts
git commit -m "Add scheduled posts API"
```

### Task 7: API — autopilot settings + notifications

**Files:**
- Create: `app/api/autopilot/route.ts` (GET / PUT)
- Create: `app/api/autopilot/pause/route.ts` (POST)
- Create: `app/api/autopilot/resume/route.ts` (POST)
- Create: `app/api/notifications/route.ts` (GET list+unread, PATCH mark-all-read)

**Interfaces:**
- Consumes: Task 5 stores, `isValidTimeZone`/`PostingTime` from `@/lib/schedule/slots`, `parsePlatforms` from `@/lib/schedule/parse`.
- Produces HTTP API:
  - `GET /api/autopilot` → `{ settings }`
  - `PUT /api/autopilot` body `{ enabled?, interests?, postingTimes?, timezone?, platforms?, reviewBeforePublish?, slotsPerDay?, leadTimeMinutes? }` → `{ settings }`
  - `POST /api/autopilot/pause` → `{ settings }`; `POST /api/autopilot/resume` → `{ settings }`
  - `GET /api/notifications` → `{ notifications, unread }`; `PATCH /api/notifications` → `{ ok: true }`

- [ ] **Step 1: Create `app/api/autopilot/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAutopilotSettings, upsertAutopilotSettings, type AutopilotSettingsPatch } from '@/lib/autopilot/store'
import { parsePlatforms } from '@/lib/schedule/parse'
import { isValidTimeZone, type PostingTime } from '@/lib/schedule/slots'

const MAX_INTERESTS = 20
const INTEREST_MAX_LEN = 80
const MAX_POSTING_TIMES = 8
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function parseInterests(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const out = [...new Set(raw.filter((x): x is string => typeof x === 'string').map((s) => s.trim().slice(0, INTEREST_MAX_LEN)).filter(Boolean))]
  return out.slice(0, MAX_INTERESTS)
}

function parsePostingTimes(raw: unknown): PostingTime[] | null {
  if (!Array.isArray(raw)) return null
  const out: PostingTime[] = []
  for (const t of raw.slice(0, MAX_POSTING_TIMES)) {
    if (!t || typeof t !== 'object') return null
    const time = (t as { time?: unknown }).time
    if (typeof time !== 'string' || !TIME_RE.test(time)) return null
    const rawDays = (t as { days?: unknown }).days
    const days = Array.isArray(rawDays)
      ? [...new Set(rawDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))]
      : undefined
    out.push({ time, ...(days && days.length ? { days } : {}) })
  }
  return out
}

// GET /api/autopilot — the user's autopilot settings (defaults if never saved).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const settings = await getAutopilotSettings(session.userId)
    return NextResponse.json({ settings })
  } catch (err) {
    console.error('[autopilot] read failed:', err)
    return NextResponse.json({ error: 'Could not load autopilot settings.' }, { status: 500 })
  }
}

// PUT /api/autopilot — update settings (partial; onboarding + settings page).
export async function PUT(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>

  const patch: AutopilotSettingsPatch = {}
  if (b.enabled !== undefined) {
    if (typeof b.enabled !== 'boolean') return NextResponse.json({ error: 'Invalid enabled flag.' }, { status: 400 })
    patch.enabled = b.enabled
  }
  if (b.reviewBeforePublish !== undefined) {
    if (typeof b.reviewBeforePublish !== 'boolean') return NextResponse.json({ error: 'Invalid review flag.' }, { status: 400 })
    patch.reviewBeforePublish = b.reviewBeforePublish
  }
  if (b.interests !== undefined) {
    const interests = parseInterests(b.interests)
    if (!interests) return NextResponse.json({ error: 'Invalid interests.' }, { status: 400 })
    patch.interests = interests
  }
  if (b.postingTimes !== undefined) {
    const postingTimes = parsePostingTimes(b.postingTimes)
    if (!postingTimes) return NextResponse.json({ error: 'Invalid posting times.' }, { status: 400 })
    patch.postingTimes = postingTimes
  }
  if (b.timezone !== undefined) {
    if (typeof b.timezone !== 'string' || !isValidTimeZone(b.timezone)) {
      return NextResponse.json({ error: 'Invalid timezone.' }, { status: 400 })
    }
    patch.timezone = b.timezone
  }
  if (b.platforms !== undefined) {
    const platforms = parsePlatforms(b.platforms)
    if (!platforms) return NextResponse.json({ error: 'Pick at least one platform.' }, { status: 400 })
    patch.platforms = platforms
  }
  if (b.slotsPerDay !== undefined) {
    if (!Number.isInteger(b.slotsPerDay) || (b.slotsPerDay as number) < 1 || (b.slotsPerDay as number) > 4) {
      return NextResponse.json({ error: 'Slots per day must be 1-4.' }, { status: 400 })
    }
    patch.slotsPerDay = b.slotsPerDay as number
  }
  if (b.leadTimeMinutes !== undefined) {
    if (!Number.isInteger(b.leadTimeMinutes) || (b.leadTimeMinutes as number) < 30 || (b.leadTimeMinutes as number) > 1440) {
      return NextResponse.json({ error: 'Lead time must be 30-1440 minutes.' }, { status: 400 })
    }
    patch.leadTimeMinutes = b.leadTimeMinutes as number
  }
  // Turning autopilot ON requires the essentials to be in place.
  if (patch.enabled) {
    const merged = { ...(await getAutopilotSettings(session.userId)), ...patch }
    if (!merged.interests.length) return NextResponse.json({ error: 'Add at least one interest first.' }, { status: 400 })
    if (!merged.postingTimes.length) return NextResponse.json({ error: 'Add at least one posting time first.' }, { status: 400 })
    if (!merged.platforms.length) return NextResponse.json({ error: 'Pick at least one platform first.' }, { status: 400 })
  }

  try {
    const settings = await upsertAutopilotSettings(session.userId, patch)
    return NextResponse.json({ settings })
  } catch (err) {
    console.error('[autopilot] update failed:', err)
    return NextResponse.json({ error: 'Could not save autopilot settings.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/autopilot/pause/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAutopilotSettings, pauseAutopilot } from '@/lib/autopilot/store'

// POST /api/autopilot/pause — user-initiated pause.
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    await pauseAutopilot(session.userId, 'user')
    return NextResponse.json({ settings: await getAutopilotSettings(session.userId) })
  } catch (err) {
    console.error('[autopilot] pause failed:', err)
    return NextResponse.json({ error: 'Could not pause autopilot.' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create `app/api/autopilot/resume/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAutopilotSettings, resumeAutopilot } from '@/lib/autopilot/store'

// POST /api/autopilot/resume — clears any pause (user or insufficient_credits).
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    await resumeAutopilot(session.userId)
    return NextResponse.json({ settings: await getAutopilotSettings(session.userId) })
  } catch (err) {
    console.error('[autopilot] resume failed:', err)
    return NextResponse.json({ error: 'Could not resume autopilot.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create `app/api/notifications/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { listNotifications, markAllRead, unreadCount } from '@/lib/notifications/store'

// GET /api/notifications — recent notifications + unread count (bell dropdown).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const [notifications, unread] = await Promise.all([
      listNotifications(session.userId),
      unreadCount(session.userId),
    ])
    return NextResponse.json({ notifications, unread })
  } catch (err) {
    console.error('[notifications] read failed:', err)
    return NextResponse.json({ error: 'Could not load notifications.' }, { status: 500 })
  }
}

// PATCH /api/notifications — mark everything read (fired when the bell opens).
export async function PATCH() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    await markAllRead(session.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications] mark read failed:', err)
    return NextResponse.json({ error: 'Could not update notifications.' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Typecheck + smoke-test**

Run: `npx tsc --noEmit`. Then with the dev server + session cookie:

```bash
curl -s localhost:3000/api/autopilot -H "Cookie: $COOKIE"
curl -s -X PUT localhost:3000/api/autopilot -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d '{"interests":["indie hacking"],"postingTimes":[{"time":"09:00"}],"timezone":"Asia/Almaty","platforms":["x"],"enabled":true}'
curl -s -X POST localhost:3000/api/autopilot/pause -H "Cookie: $COOKIE"
curl -s -X POST localhost:3000/api/autopilot/resume -H "Cookie: $COOKIE"
curl -s localhost:3000/api/notifications -H "Cookie: $COOKIE"
```

Expected: defaults on first GET; PUT echoes saved settings with `enabled: true`; pause sets `pausedAt`/`pauseReason: "user"`; resume clears both; notifications returns `{ notifications: [], unread: 0 }`.

- [ ] **Step 6: Commit**

```bash
git add app/api/autopilot app/api/notifications
git commit -m "Add autopilot notifications API"
```

---

### Task 8: Schedule button + modal on the new-post page

**Files:**
- Create: `components/app/ScheduleModal.tsx`
- Modify: `components/app/ComposeHome.tsx` (inside `DraftCard`)

**Interfaces:**
- Consumes: `POST /api/scheduled-posts` (Task 6); `DraftImage` from `@/components/app/DraftImageControls`; `Spinner`.
- Produces: `<ScheduleModal text images platforms onClose onScheduled />` where `onScheduled(whenIso: string)` fires after a 201.

- [ ] **Step 1: Create `components/app/ScheduleModal.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import type { DraftImage } from '@/components/app/DraftImageControls'

// Hand-rolled modal, matching the TopUpModal pattern (no shared Modal primitive).
// The datetime-local input reads in the browser's local time; we convert to UTC
// ISO for storage and send the browser's IANA zone for display + slot math.

function defaultWhen(): string {
  // Next full hour, local, in datetime-local format (YYYY-MM-DDTHH:MM).
  const d = new Date(Date.now() + 60 * 60_000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

export function ScheduleModal({
  text,
  images,
  platforms,
  onClose,
  onScheduled,
}: {
  text: string
  images: DraftImage[]
  platforms: string[]
  onClose: () => void
  onScheduled: (whenIso: string) => void
}) {
  const [when, setWhen] = useState(defaultWhen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  async function schedule() {
    const local = new Date(when)
    if (Number.isNaN(local.getTime())) {
      setError('Pick a date and time.')
      return
    }
    if (local.getTime() <= Date.now()) {
      setError('Pick a time in the future.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          platforms,
          media: images.map((i) => ({ url: i.url, alt: i.alt })),
          scheduledFor: local.toISOString(),
          timezone,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not schedule. Try again.')
        return
      }
      onScheduled(local.toISOString())
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Schedule post" className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-charcoal-black/70 backdrop-blur-[4px]" />
      <div className="relative w-full max-w-md rounded-3xl border border-border-muted bg-surface p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h2 className="mb-1 font-headline-lg text-headline-lg">Schedule this post</h2>
        <p className="mb-5 font-body-sm text-body-sm text-on-surface-variant">
          It goes out automatically at the time you pick ({timezone.replace(/_/g, ' ')}).
        </p>

        <label className="mb-1 block font-code-label text-code-label uppercase text-on-surface-variant/70" htmlFor="schedule-when">
          Publish at
        </label>
        <input
          id="schedule-when"
          type="datetime-local"
          value={when}
          min={defaultWhen().slice(0, 16)}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-xl border border-border-muted bg-surface-container-lowest p-3 font-body-md text-on-surface [color-scheme:dark] focus:border-electric-indigo focus:outline-none"
        />

        <p className="mt-3 font-code-label text-code-label text-on-surface-variant/60">
          Posting to: {platforms.map((p) => (p === 'x' ? 'X' : 'Threads')).join(' + ')}
        </p>

        {error && <p className="mt-3 font-body-sm text-body-sm text-error">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={schedule}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {busy ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">event</span>}
            {busy ? 'Scheduling…' : 'Schedule'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border-muted px-5 py-2.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the Schedule button into `DraftCard`** (`components/app/ComposeHome.tsx`)

Add the import at the top of the file:

```tsx
import { ScheduleModal } from '@/components/app/ScheduleModal'
```

Inside `DraftCard`, next to the existing state (after `const [publishing, setPublishing] = useState(false)`):

```tsx
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduledFor, setScheduledFor] = useState<string | null>(null)
```

In the action row (`<div className="mt-4 flex items-center gap-3">`, currently holding the Publish button + char counter), add the Schedule button right after the Publish button:

```tsx
        <button
          type="button"
          data-tour="schedule"
          onClick={() => setScheduleOpen(true)}
          disabled={publishing || !text.trim() || chosen.length === 0}
          className="flex items-center gap-1.5 rounded-full border border-electric-indigo/60 px-4 py-2 font-code-label text-code-label text-electric-indigo transition-all hover:bg-electric-indigo/10 active:scale-95 disabled:opacity-60"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">event</span>
          Schedule
        </button>
```

After the per-platform results block (right before the "Post-publish nudge" comment), add the confirmation row + modal:

```tsx
      {scheduledFor && (
        <div className="mt-3 flex flex-col gap-1 rounded-xl border border-cyber-lime/30 bg-cyber-lime/5 p-3">
          <p className="font-body-sm text-body-sm text-on-surface">
            scheduled for {new Date(scheduledFor).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — it&apos;s on your calendar.
          </p>
          <a href="/app/calendar" className="font-code-label text-code-label text-cyber-lime hover:underline">
            View calendar →
          </a>
        </div>
      )}

      {scheduleOpen && (
        <ScheduleModal
          text={text}
          images={images}
          platforms={chosen.map((d) => d.key)}
          onClose={() => setScheduleOpen(false)}
          onScheduled={(when) => {
            setScheduleOpen(false)
            setScheduledFor(when)
          }}
        />
      )}
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`. Generate a draft (or reopen a history chat with one), click **Schedule**, pick a future time, confirm the lime confirmation row appears and `GET /api/scheduled-posts` (curl from Task 6) shows the row.

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/app/ScheduleModal.tsx components/app/ComposeHome.tsx
git commit -m "Add schedule button modal"
```

### Task 9: Calendar page (month + week) + sidebar nav items

**Files:**
- Create: `app/app/calendar/page.tsx`
- Create: `components/app/calendar/CalendarView.tsx`
- Create: `components/app/calendar/PostEditorModal.tsx`
- Modify: `components/app/AppSidebar.tsx` (`navItems`)

**Interfaces:**
- Consumes: `GET/PATCH/DELETE /api/scheduled-posts` (Task 6); `ScheduledPost` type from `@/lib/schedule/types` (types are safe in client components).
- Produces: `/app/calendar` page. Source markers: manual = `electric-indigo` (violet), autopilot = `cyber-lime` (lime).

- [ ] **Step 1: Add nav items in `components/app/AppSidebar.tsx`**

Replace the `navItems` function body:

```ts
function navItems(voiceCount: number): NavItem[] {
  return [
    { href: '/app/calendar', label: 'Calendar', icon: 'calendar_month' },
    { href: '/app/autopilot', label: 'Autopilot', icon: 'auto_awesome' },
    { href: '/app/voices', label: 'Voices', icon: 'graphic_eq', badge: voiceCount },
    { href: '/app/prompts', label: 'Prompts', icon: 'bookmarks' },
    { href: '/app/knowledge', label: 'Knowledge', icon: 'menu_book', soon: true },
  ]
}
```

- [ ] **Step 2: Create `app/app/calendar/page.tsx`** (auth + onboarding gating come from `app/app/layout.tsx`)

```tsx
import { CalendarView } from '@/components/app/calendar/CalendarView'

export const metadata = { title: 'Calendar — Outloud' }

export default function CalendarPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg">Calendar</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Everything queued to publish — your scheduled posts and autopilot&apos;s, side by side.
        </p>
      </div>
      <CalendarView />
    </div>
  )
}
```

- [ ] **Step 3: Create `components/app/calendar/CalendarView.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import type { ScheduledPost } from '@/lib/schedule/types'
import { PostEditorModal } from './PostEditorModal'

// ONE calendar, two sources: manual (violet) and autopilot (lime). Month and
// week views over the same GET /api/scheduled-posts range read.

type ViewMode = 'month' | 'week'

const DAY_MS = 86_400_000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Local-midnight Date for "today". All grid math is in the BROWSER's zone —
 *  the calendar shows times as the user's device sees them. */
function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // Monday start
  return x
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'scheduled', cls: 'border-border-muted text-on-surface-variant' },
  publishing: { label: 'publishing', cls: 'border-electric-indigo/60 text-electric-indigo' },
  published: { label: 'published', cls: 'border-cyber-lime/60 text-cyber-lime' },
  failed: { label: 'failed', cls: 'border-error/60 text-error' },
  draft: { label: 'draft', cls: 'border-border-muted text-on-surface-variant' },
}

function PlatformIcons({ platforms }: { platforms: string[] }) {
  return (
    <span className="font-code-label text-[10px] uppercase text-on-surface-variant/70">
      {platforms.map((p) => (p === 'x' ? 'X' : 'Th')).join('·')}
    </span>
  )
}

function PostChip({ post, onClick }: { post: ScheduledPost; onClick: () => void }) {
  const auto = post.source === 'autopilot'
  return (
    <button
      type="button"
      onClick={onClick}
      title={post.content}
      className={`flex w-full items-center gap-1.5 truncate rounded-lg border px-1.5 py-1 text-left font-code-label text-[11px] transition-colors ${
        auto
          ? 'border-cyber-lime/40 bg-cyber-lime/10 text-on-surface hover:bg-cyber-lime/20'
          : 'border-electric-indigo/40 bg-electric-indigo/10 text-on-surface hover:bg-electric-indigo/20'
      } ${post.status === 'failed' ? 'border-error/60' : ''}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${auto ? 'bg-cyber-lime' : 'bg-electric-indigo'}`} />
      <span className="shrink-0">
        {new Date(post.scheduledFor).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="truncate text-on-surface-variant">{post.content}</span>
    </button>
  )
}

export function CalendarView() {
  const [view, setView] = useState<ViewMode>('month')
  // Anchor: first of the shown month, or the Monday of the shown week.
  const [anchor, setAnchor] = useState(() => new Date())
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ScheduledPost | null>(null)

  const range = useMemo(() => {
    if (view === 'week') {
      const from = startOfWeek(anchor)
      return { from, to: new Date(from.getTime() + 7 * DAY_MS) }
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const gridStart = startOfWeek(first)
    return { from: gridStart, to: new Date(gridStart.getTime() + 42 * DAY_MS) }
  }, [anchor, view])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = `from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      const res = await fetch(`/api/scheduled-posts?${qs}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not load the calendar.')
        return
      }
      setPosts(data.posts ?? [])
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>()
    for (const p of posts) {
      const key = dayKey(new Date(p.scheduledFor))
      map.set(key, [...(map.get(key) ?? []), p])
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    return map
  }, [posts])

  function move(dir: -1 | 1) {
    setAnchor((a) =>
      view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : new Date(a.getTime() + dir * 7 * DAY_MS),
    )
  }

  const todayKey = dayKey(new Date())
  const title =
    view === 'month'
      ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `Week of ${startOfWeek(anchor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  const days = useMemo(() => {
    const count = view === 'month' ? 42 : 7
    const start = view === 'month' ? startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) : startOfWeek(anchor)
    return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * DAY_MS))
  }, [anchor, view])

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous" onClick={() => move(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <button type="button" aria-label="Next" onClick={() => move(1)} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
          <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 rounded-full border border-border-muted px-3 py-1.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface">
            Today
          </button>
        </div>
        <h2 className="font-body-md text-body-md font-bold text-on-surface">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          {(['month', 'week'] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={view === m}
              onClick={() => setView(m)}
              className={`rounded-full border px-3 py-1.5 font-code-label text-code-label capitalize transition-colors ${
                view === m ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface' : 'border-border-muted text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 font-code-label text-code-label text-on-surface-variant/70">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-electric-indigo" /> you</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyber-lime" /> autopilot</span>
        {loading && <Spinner size={14} />}
      </div>

      {error && <p className="mb-3 font-body-sm text-body-sm text-error">{error}</p>}

      {view === 'month' ? (
        <div className="overflow-hidden rounded-2xl border border-border-muted">
          <div className="grid grid-cols-7 border-b border-border-muted bg-surface-container-lowest">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2 text-center font-code-label text-code-label uppercase text-on-surface-variant/60">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = d.getMonth() === anchor.getMonth()
              const key = dayKey(d)
              const dayPosts = byDay.get(key) ?? []
              return (
                <div key={key} className={`min-h-24 border-b border-r border-border-muted p-1.5 last:border-r-0 ${inMonth ? '' : 'bg-surface-container-lowest/50 opacity-50'}`}>
                  <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full font-code-label text-[11px] ${key === todayKey ? 'bg-electric-indigo text-white' : 'text-on-surface-variant'}`}>
                    {d.getDate()}
                  </span>
                  <div className="flex flex-col gap-1">
                    {dayPosts.slice(0, 3).map((p) => <PostChip key={p.id} post={p} onClick={() => setEditing(p)} />)}
                    {dayPosts.length > 3 && (
                      <span className="px-1.5 font-code-label text-[10px] text-on-surface-variant/60">+{dayPosts.length - 3} more</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {days.map((d) => {
            const key = dayKey(d)
            const dayPosts = byDay.get(key) ?? []
            return (
              <div key={key} className="rounded-2xl border border-border-muted bg-surface-container-low p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`font-body-md text-body-md font-bold ${key === todayKey ? 'text-electric-indigo' : 'text-on-surface'}`}>
                    {d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {dayPosts.length === 0 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant/50">nothing queued</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayPosts.map((p) => {
                      const auto = p.source === 'autopilot'
                      const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.scheduled
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setEditing(p)}
                          className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                            auto ? 'border-cyber-lime/30 hover:border-cyber-lime/60' : 'border-electric-indigo/30 hover:border-electric-indigo/60'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${auto ? 'bg-cyber-lime' : 'bg-electric-indigo'}`} />
                            <span className="font-code-label text-code-label text-on-surface">
                              {new Date(p.scheduledFor).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <PlatformIcons platforms={p.platforms} />
                            <span className={`ml-auto rounded-full border px-2 py-0.5 font-code-label text-[10px] uppercase ${badge.cls}`}>{badge.label}</span>
                          </span>
                          <span className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{p.content}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <PostEditorModal
          post={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/app/calendar/PostEditorModal.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import type { ScheduledPost, SchedulePlatform } from '@/lib/schedule/types'

// Edit/cancel a queued post. Published/publishing posts are read-only — the
// API enforces it too (409), this is just honest UI.

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const ALL_PLATFORMS: { key: SchedulePlatform; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'threads', label: 'Threads' },
]

export function PostEditorModal({
  post,
  onClose,
  onChanged,
}: {
  post: ScheduledPost
  onClose: () => void
  onChanged: () => void
}) {
  const editable = post.status === 'scheduled' || post.status === 'draft'
  const [content, setContent] = useState(post.content)
  const [when, setWhen] = useState(toLocalInput(post.scheduledFor))
  const [platforms, setPlatforms] = useState<SchedulePlatform[]>(post.platforms)
  const [busy, setBusy] = useState<'save' | 'cancel' | null>(null)
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  function toggle(p: SchedulePlatform) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  async function save() {
    const local = new Date(when)
    if (!content.trim()) return setError('Post text cannot be empty.')
    if (Number.isNaN(local.getTime()) || local.getTime() <= Date.now()) return setError('Pick a time in the future.')
    if (platforms.length === 0) return setError('Pick at least one platform.')
    setError('')
    setBusy('save')
    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          scheduledFor: local.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          platforms,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? 'Could not save. Try again.')
      onChanged()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function cancelPost() {
    setError('')
    setBusy('cancel')
    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? 'Could not cancel. Try again.')
      onChanged()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const auto = post.source === 'autopilot'

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit scheduled post" className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-charcoal-black/70 backdrop-blur-[4px]" />
      <div className="relative w-full max-w-lg rounded-3xl border border-border-muted bg-surface p-6 shadow-2xl">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="mb-4 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${auto ? 'bg-cyber-lime' : 'bg-electric-indigo'}`} />
          <span className="font-code-label text-code-label uppercase text-on-surface-variant">
            {auto ? 'autopilot post' : 'your post'} · {post.status}
          </span>
        </div>

        {editable ? (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-40 w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md leading-relaxed text-on-surface focus:border-electric-indigo focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                aria-label="Publish at"
                className="rounded-xl border border-border-muted bg-surface-container-lowest p-2.5 font-body-sm text-on-surface [color-scheme:dark] focus:border-electric-indigo focus:outline-none"
              />
              {ALL_PLATFORMS.map((p) => {
                const on = platforms.includes(p.key)
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(p.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-code-label text-code-label transition-colors ${
                      on ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface' : 'border-border-muted text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{on ? 'check_circle' : 'radio_button_unchecked'}</span>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md leading-relaxed text-on-surface">{post.content}</p>
            {post.status === 'published' && post.externalPostIds && (
              <div className="mt-3 flex flex-col gap-1">
                {post.externalPostIds.x && (
                  <span className="font-code-label text-code-label text-cyber-lime">published to X</span>
                )}
                {post.externalPostIds.threads && (
                  <span className="font-code-label text-code-label text-cyber-lime">published to Threads</span>
                )}
              </div>
            )}
            {post.status === 'failed' && post.error && (
              <p className="mt-3 font-body-sm text-body-sm text-error">{post.error}</p>
            )}
          </>
        )}

        {error && <p className="mt-3 font-body-sm text-body-sm text-error">{error}</p>}

        {editable && (
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
            >
              {busy === 'save' ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span>}
              Save
            </button>
            {confirmCancel ? (
              <button
                type="button"
                onClick={cancelPost}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-full bg-error px-5 py-2.5 font-code-label text-code-label font-bold text-charcoal-black transition-all active:scale-95 disabled:opacity-60"
              >
                {busy === 'cancel' ? <Spinner size={16} /> : null}
                Yes, cancel it
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="rounded-full border border-border-muted px-5 py-2.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:border-error/60 hover:text-error"
              >
                Cancel post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev` → `/app/calendar`. The post scheduled in Task 8 shows as a violet chip in month view; week view shows its card with a status badge; opening it allows editing text/time/platforms and cancelling (row disappears after cancel). Sidebar shows Calendar + Autopilot items (Autopilot 404s until Task 10 — expected).

- [ ] **Step 6: Typecheck + tests, then commit**

Run: `npx tsc --noEmit && npm test` — expected clean.

```bash
git add app/app/calendar components/app/calendar components/app/AppSidebar.tsx
git commit -m "Add calendar page"
```

### Task 10: Autopilot settings page

**Files:**
- Create: `app/app/autopilot/page.tsx`
- Create: `components/app/autopilot/AutopilotSettingsPanel.tsx`

**Interfaces:**
- Consumes: `getAutopilotSettings`, `listUpcomingAutopilot` (server, Tasks 4–5); `PUT /api/autopilot`, `POST /api/autopilot/pause|resume` (client, Task 7); `AutopilotSettings` type; `ScheduledPost` type.
- Produces: `/app/autopilot` page with interests, posting times, platforms, slots/day, toggles, queued-posts preview, pause/resume, paused-for-credits banner.

- [ ] **Step 1: Create `app/app/autopilot/page.tsx`**

```tsx
import { getSession } from '@/lib/auth/session'
import { getAutopilotSettings } from '@/lib/autopilot/store'
import { listUpcomingAutopilot } from '@/lib/schedule/store'
import { getAccount as getXAccount } from '@/lib/x/store'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { AutopilotSettingsPanel } from '@/components/app/autopilot/AutopilotSettingsPanel'

export const metadata = { title: 'Autopilot — Outloud' }

export default async function AutopilotPage() {
  const session = await getSession()
  if (!session) return null // layout already redirects unauthenticated users
  const [settings, upcoming, x, threads] = await Promise.all([
    getAutopilotSettings(session.userId),
    listUpcomingAutopilot(session.userId, 5),
    getXAccount(session.userId),
    getThreadsAccount(session.userId),
  ])
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg">Autopilot</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Keeps your calendar full — writes posts in your voice about your interests and fills the empty slots. Your own scheduled posts always win.
        </p>
      </div>
      <AutopilotSettingsPanel
        initial={settings}
        upcoming={upcoming}
        xConnected={Boolean(x)}
        threadsConnected={Boolean(threads)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `components/app/autopilot/AutopilotSettingsPanel.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import type { AutopilotSettings } from '@/lib/autopilot/store'
import type { PostingTime } from '@/lib/schedule/slots'
import type { ScheduledPost, SchedulePlatform } from '@/lib/schedule/types'

const DAY_LABELS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-electric-indigo' : 'bg-surface-container-highest'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function AutopilotSettingsPanel({
  initial,
  upcoming,
  xConnected,
  threadsConnected,
}: {
  initial: AutopilotSettings
  upcoming: ScheduledPost[]
  xConnected: boolean
  threadsConnected: boolean
}) {
  const [s, setS] = useState(initial)
  const [interestDraft, setInterestDraft] = useState('')
  const [busy, setBusy] = useState<'save' | 'pause' | 'resume' | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const connected: Record<SchedulePlatform, boolean> = { x: xConnected, threads: threadsConnected }
  const pausedForCredits = s.pausedAt && s.pauseReason === 'insufficient_credits'

  function patch(p: Partial<AutopilotSettings>) {
    setSaved(false)
    setS((cur) => ({ ...cur, ...p }))
  }

  function addInterest() {
    const v = interestDraft.trim()
    if (!v) return
    if (!s.interests.includes(v)) patch({ interests: [...s.interests, v] })
    setInterestDraft('')
  }

  function setTime(i: number, next: Partial<PostingTime>) {
    patch({ postingTimes: s.postingTimes.map((t, idx) => (idx === i ? { ...t, ...next } : t)) })
  }

  function toggleDay(i: number, day: number) {
    const t = s.postingTimes[i]
    const days = t.days ?? []
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()
    setTime(i, { days: next.length ? next : undefined })
  }

  async function save(overrides: Partial<AutopilotSettings> = {}) {
    setError('')
    setBusy('save')
    try {
      const next = { ...s, ...overrides }
      const res = await fetch('/api/autopilot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: next.enabled,
          interests: next.interests,
          postingTimes: next.postingTimes,
          timezone: next.timezone,
          platforms: next.platforms,
          reviewBeforePublish: next.reviewBeforePublish,
          slotsPerDay: next.slotsPerDay,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save. Try again.')
        return
      }
      setS(data.settings)
      setSaved(true)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function pauseResume(action: 'pause' | 'resume') {
    setError('')
    setBusy(action)
    try {
      const res = await fetch(`/api/autopilot/${action}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      setS(data.settings)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const card = 'rounded-2xl border border-border-muted bg-surface-container-low p-5'

  return (
    <div className="flex flex-col gap-4">
      {pausedForCredits && (
        <div className="flex flex-col gap-2 rounded-2xl border border-error/40 bg-error/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body-sm text-body-sm text-on-surface">
            autopilot is paused — you&apos;re out of credits. top up to get it writing again.
          </p>
          <a href="/app/settings/billing" className="shrink-0 rounded-full bg-electric-indigo px-4 py-2 text-center font-code-label text-code-label font-bold text-white transition-colors hover:bg-primary-container">
            Top up credits
          </a>
        </div>
      )}

      {/* Master toggle */}
      <div className={`${card} flex items-center justify-between gap-4`}>
        <div>
          <p className="font-body-md text-body-md font-bold text-on-surface">Autopilot</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {s.enabled ? (s.pausedAt ? 'on, but paused' : 'on — filling empty slots ahead of time') : 'off'}
          </p>
        </div>
        <Toggle on={s.enabled} onChange={(v) => patch({ enabled: v })} label="Autopilot enabled" />
      </div>

      {/* Interests */}
      <div className={card}>
        <p className="mb-1 font-body-md text-body-md font-bold text-on-surface">Interest areas</p>
        <p className="mb-3 font-body-sm text-body-sm text-on-surface-variant">What autopilot writes about, rotating day by day.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {s.interests.map((it) => (
            <span key={it} className="flex items-center gap-1 rounded-full border border-border-muted bg-surface-container px-3 py-1 font-code-label text-code-label text-on-surface">
              {it}
              <button type="button" aria-label={`Remove ${it}`} onClick={() => patch({ interests: s.interests.filter((x) => x !== it) })} className="text-on-surface-variant hover:text-error">
                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={interestDraft}
            onChange={(e) => setInterestDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }}
            placeholder="e.g. building in public"
            aria-label="Add interest"
            className="flex-1 rounded-xl border border-border-muted bg-surface-container-lowest p-2.5 font-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none"
          />
          <button type="button" onClick={addInterest} className="rounded-full border border-electric-indigo/60 px-4 font-code-label text-code-label text-electric-indigo transition-colors hover:bg-electric-indigo/10">
            Add
          </button>
        </div>
      </div>

      {/* Posting times */}
      <div className={card}>
        <p className="mb-1 font-body-md text-body-md font-bold text-on-surface">Posting times</p>
        <p className="mb-3 font-body-sm text-body-sm text-on-surface-variant">
          Slots autopilot can fill, in your timezone ({s.timezone.replace(/_/g, ' ')}). Leave days unselected to post every day.
        </p>
        <div className="flex flex-col gap-3">
          {s.postingTimes.map((t, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={t.time}
                onChange={(e) => setTime(i, { time: e.target.value })}
                aria-label={`Posting time ${i + 1}`}
                className="rounded-xl border border-border-muted bg-surface-container-lowest p-2 font-code-label text-code-label text-on-surface [color-scheme:dark] focus:border-electric-indigo focus:outline-none"
              />
              <div className="flex gap-1">
                {DAY_LABELS.map((label, day) => {
                  const on = !t.days || t.days.includes(day)
                  const explicit = t.days?.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={Boolean(explicit)}
                      onClick={() => toggleDay(i, day)}
                      className={`rounded-full border px-2 py-1 font-code-label text-[10px] uppercase transition-colors ${
                        on ? 'border-electric-indigo/60 text-electric-indigo' : 'border-border-muted text-on-surface-variant/50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <button type="button" aria-label="Remove time" onClick={() => patch({ postingTimes: s.postingTimes.filter((_, idx) => idx !== i) })} className="ml-auto text-on-surface-variant hover:text-error">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch({ postingTimes: [...s.postingTimes, { time: '09:00' }] })}
            className="self-start rounded-full border border-border-muted px-4 py-1.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:border-electric-indigo/60 hover:text-on-surface"
          >
            + Add time
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="slots-per-day" className="font-body-sm text-body-sm text-on-surface-variant">Posts per day</label>
          <select
            id="slots-per-day"
            value={s.slotsPerDay}
            onChange={(e) => patch({ slotsPerDay: Number(e.target.value) })}
            className="rounded-xl border border-border-muted bg-surface-container-lowest p-2 font-code-label text-code-label text-on-surface focus:border-electric-indigo focus:outline-none"
          >
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Platforms + review toggle */}
      <div className={card}>
        <p className="mb-3 font-body-md text-body-md font-bold text-on-surface">Publish to</p>
        <div className="flex gap-2">
          {(['x', 'threads'] as SchedulePlatform[]).map((p) => {
            const on = s.platforms.includes(p)
            const isConnected = connected[p]
            return (
              <button
                key={p}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!isConnected}
                title={isConnected ? undefined : `Connect ${p === 'x' ? 'X' : 'Threads'} in Profile to enable`}
                onClick={() => patch({ platforms: on ? s.platforms.filter((x) => x !== p) : [...s.platforms, p] })}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-code-label text-code-label transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  on ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface' : 'border-border-muted text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{on ? 'check_circle' : 'radio_button_unchecked'}</span>
                {p === 'x' ? 'X' : 'Threads'}
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-body-md text-body-md text-on-surface">Review before publishing</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Get a heads-up when a post is queued, so you can edit or cancel it first.</p>
          </div>
          <Toggle on={s.reviewBeforePublish} onChange={(v) => patch({ reviewBeforePublish: v })} label="Review before publishing" />
        </div>
      </div>

      {/* Save + pause/resume */}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => save()}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-6 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
        >
          {busy === 'save' ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span>}
          Save
        </button>
        {s.enabled && (s.pausedAt ? (
          <button type="button" onClick={() => pauseResume('resume')} disabled={busy !== null} className="flex items-center gap-1.5 rounded-full border border-cyber-lime/60 px-5 py-2.5 font-code-label text-code-label text-cyber-lime transition-colors hover:bg-cyber-lime/10 disabled:opacity-60">
            {busy === 'resume' ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">play_arrow</span>}
            Resume
          </button>
        ) : (
          <button type="button" onClick={() => pauseResume('pause')} disabled={busy !== null} className="flex items-center gap-1.5 rounded-full border border-border-muted px-5 py-2.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-60">
            {busy === 'pause' ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">pause</span>}
            Pause
          </button>
        ))}
        {saved && <span aria-live="polite" className="font-code-label text-code-label text-cyber-lime">saved</span>}
      </div>

      {/* Upcoming auto posts */}
      <div className={card}>
        <p className="mb-3 font-body-md text-body-md font-bold text-on-surface">Queued by autopilot</p>
        {upcoming.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant/60">
            nothing queued yet — posts appear here up to {Math.round(s.leadTimeMinutes / 60)}h before their slot.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((p) => (
              <a key={p.id} href="/app/calendar" className="flex items-start gap-2 rounded-xl border border-cyber-lime/30 p-3 transition-colors hover:border-cyber-lime/60">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyber-lime" />
                <span className="min-w-0">
                  <span className="font-code-label text-code-label text-on-surface">
                    {new Date(p.scheduledFor).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block font-body-sm text-body-sm text-on-surface-variant">{p.content}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in the browser**

`/app/autopilot`: add interests + a posting time, pick platforms, Save (persists across reload), toggle enabled (fails with a clear error if essentials missing), pause/resume works.

- [ ] **Step 4: Typecheck + tests, then commit**

Run: `npx tsc --noEmit && npm test` — expected clean.

```bash
git add app/app/autopilot components/app/autopilot
git commit -m "Add autopilot settings page"
```

---

### Task 11: Onboarding step 4 — autopilot setup

**Files:**
- Modify: `components/app/VoiceOnboarding.tsx`

**Interfaces:**
- Consumes: `PUT /api/autopilot` (Task 7).
- Produces: a 4th, skippable onboarding step (interests, posting time + timezone, autopilot toggle, review toggle) after the voice is built.

- [ ] **Step 1: Extend the stepper**

In `components/app/VoiceOnboarding.tsx` change:

```ts
type Step = 1 | 2 | 3 | 4
const STEP_LABELS = ['Name', 'Source', 'Build', 'Autopilot'] as const
```

(The `Stepper` component maps over `STEP_LABELS` and needs no other change; `const n = (i + 1) as Step` still typechecks.)

- [ ] **Step 2: Route Build → step 4 instead of `/app`**

Replace the body of `onBuild()`:

```ts
  async function onBuild() {
    if (!profileId || !enough) return
    setError('')
    setContinuing(true)
    try {
      await generateStyleGuide(profileId)
      setContinuing(false)
      setStep(4) // voice is ready — offer autopilot before entering the app
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build your voice. Try again.')
      setContinuing(false)
    }
  }
```

- [ ] **Step 3: Add step-4 state + save handler** (near the other `useState` hooks)

```ts
  // Step 4 — autopilot setup (skippable). Defaults: browser timezone, 09:00 daily,
  // review-before-publish ON (spec §12).
  const [apInterests, setApInterests] = useState('')
  const [apTime, setApTime] = useState('09:00')
  const [apTimezone, setApTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [apEnabled, setApEnabled] = useState(false)
  const [apReview, setApReview] = useState(true)

  async function finishOnboarding(skip: boolean) {
    setError('')
    setBusy(true)
    try {
      const interests = apInterests.split(',').map((s) => s.trim()).filter(Boolean)
      if (!skip && (interests.length > 0 || apEnabled)) {
        const res = await fetch('/api/autopilot', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interests,
            postingTimes: [{ time: apTime }],
            timezone: apTimezone,
            platforms: ['x', 'threads'],
            reviewBeforePublish: apReview,
            enabled: apEnabled && interests.length > 0,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? 'Could not save autopilot settings.')
          setBusy(false)
          return
        }
      }
      router.push('/app')
      router.refresh()
    } catch {
      setError('Network error. Try again.')
      setBusy(false)
    }
  }
```

- [ ] **Step 4: Render step 4** — add before the final (step 3) return, following the shell/heading style of steps 1–3:

```tsx
  // ── Step 4: autopilot (skippable) ──
  if (step === 4) {
    const inputCls =
      'w-full rounded-xl border border-border-muted bg-surface-container-lowest p-3 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none'
    return (
      <div className={`${shell} max-w-md`}>
        <Stepper step={4} />
        <h1 className="mb-2 font-headline-xl text-headline-xl">Put posting on autopilot?</h1>
        <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
          Outloud can keep your calendar full — writing posts in your voice about your interests. You stay in control: review anything before it goes out.
        </p>

        <label className="mb-1 block font-code-label text-code-label uppercase text-on-surface-variant/70" htmlFor="ap-interests">
          Interests (comma-separated)
        </label>
        <input id="ap-interests" value={apInterests} onChange={(e) => setApInterests(e.target.value)} placeholder="e.g. building in public, ai tools" className={inputCls} />

        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block font-code-label text-code-label uppercase text-on-surface-variant/70" htmlFor="ap-time">Posting time</label>
            <input id="ap-time" type="time" value={apTime} onChange={(e) => setApTime(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block font-code-label text-code-label uppercase text-on-surface-variant/70" htmlFor="ap-tz">Timezone</label>
            <select id="ap-tz" value={apTimezone} onChange={(e) => setApTimezone(e.target.value)} className={inputCls}>
              {Intl.supportedValuesOf('timeZone').map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4">
          <span className="font-body-md text-body-md text-on-surface">Turn autopilot on</span>
          <input type="checkbox" checked={apEnabled} onChange={(e) => setApEnabled(e.target.checked)} className="h-5 w-5 accent-[#b06bff]" />
        </label>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-4">
          <span className="font-body-md text-body-md text-on-surface">Review posts before they publish</span>
          <input type="checkbox" checked={apReview} onChange={(e) => setApReview(e.target.checked)} className="h-5 w-5 accent-[#b06bff]" />
        </label>

        {error && <p className="mt-3 font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="button"
          onClick={() => finishOnboarding(false)}
          disabled={busy}
          className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-electric-indigo px-6 py-3 font-bold text-white transition-colors hover:bg-primary-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <><Spinner size={18} /> Saving…</> : <>Continue<span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span></>}
        </button>
        <button type="button" onClick={() => finishOnboarding(true)} disabled={busy} className="mt-3 w-full text-center font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface">
          skip for now — you can set this up later in Autopilot
        </button>
      </div>
    )
  }
```

> NOTE: `apEnabled && interests.length > 0` — the API rejects `enabled: true` with no interests/platforms, so the client only requests enable when it can succeed; onboarding always saves with both default platforms (the cron later intersects with actually-connected accounts).

- [ ] **Step 5: Verify** — create a fresh test account (or delete your voice) and walk Name → Source → Build → Autopilot; both Continue and skip land on `/app`; `GET /api/autopilot` reflects saved values.

- [ ] **Step 6: Typecheck + tests, then commit**

```bash
npx tsc --noEmit && npm test
git add components/app/VoiceOnboarding.tsx
git commit -m "Add autopilot onboarding step"
```

---

### Task 12: Notifications bell in the sidebar

**Files:**
- Create: `components/app/NotificationsBell.tsx`
- Modify: `components/app/AppSidebar.tsx` (render the bell in the footer)

**Interfaces:**
- Consumes: `GET/PATCH /api/notifications` (Task 7).
- Produces: bell button with unread badge; opening it lists recent notifications and marks all read.

- [ ] **Step 1: Create `components/app/NotificationsBell.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

type Notif = { id: string; kind: string; title: string; body: string | null; readAt: string | null; createdAt: string }

const KIND_ICON: Record<string, string> = {
  autopilot_queued: 'auto_awesome',
  autopilot_paused: 'pause_circle',
  publish_failed: 'error',
}

// Lightweight in-app notifications surface (spec §8): a bell + dropdown panel.
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { notifications: [], unread: 0 }))
      .then((d) => { setItems(d.notifications ?? []); setUnread(d.unread ?? 0) })
      .catch(() => {})
  }, [])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        onClick={toggleOpen}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:bg-white/[0.04] hover:text-on-surface"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">notifications</span>
        Notifications
        {unread > 0 && (
          <span className="ml-auto rounded-full bg-electric-indigo px-2 py-0.5 font-code-label text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 max-h-80 w-72 overflow-y-auto rounded-2xl border border-border-muted bg-surface-container p-2 shadow-2xl">
          {items.length === 0 ? (
            <p className="p-3 font-body-sm text-body-sm text-on-surface-variant/60">nothing yet</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-xl p-2.5 hover:bg-white/[0.04]">
                <span aria-hidden="true" className={`material-symbols-outlined mt-0.5 text-[18px] ${n.kind === 'publish_failed' ? 'text-error' : 'text-electric-indigo'}`}>
                  {KIND_ICON[n.kind] ?? 'info'}
                </span>
                <span className="min-w-0">
                  <span className="block font-body-sm text-body-sm text-on-surface">{n.title}</span>
                  {n.body && <span className="block font-code-label text-code-label text-on-surface-variant">{n.body}</span>}
                  <span className="block font-code-label text-[10px] text-on-surface-variant/50">
                    {new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Render it in `components/app/AppSidebar.tsx`**

Import: `import { NotificationsBell } from '@/components/app/NotificationsBell'`. In the `footer` JSX, insert `<NotificationsBell />` between the profile `<Link>` and the "Billing & usage" link.

- [ ] **Step 3: Verify** — insert a test row (`npx tsx -e` with `addNotification`, or wait for Task 14's live test); bell shows badge, opens, marks read.

- [ ] **Step 4: Typecheck, commit**

```bash
npx tsc --noEmit
git add components/app/NotificationsBell.tsx components/app/AppSidebar.tsx
git commit -m "Add notifications bell"
```

### Task 13: Publish executor + publish cron route

**Files:**
- Create: `lib/cron/auth.ts`
- Create: `lib/schedule/publish.ts`
- Test: `lib/schedule/publish.test.ts` (pure `decideOutcome` only)
- Create: `app/api/cron/publish/route.ts`

**Interfaces:**
- Consumes: Task 4 store (`listDuePostIds`, `claimForPublishing`, `finishPublish`), Task 5 `addNotification`, X/Threads clients + stores + error classes.
- Produces:
  - `isCronAuthorized(req: Request): boolean` from `@/lib/cron/auth`
  - `publishScheduledPost(post: ScheduledPost): Promise<'published' | 'scheduled' | 'failed'>` — **single-post callable** (spec §6 upgrade path: a later QStash callback calls exactly this after its own claim)
  - `decideOutcome(retryCount: number, results: AttemptResult[], prior: ExternalPostIds): PublishOutcome` (pure, exported for tests)
  - `GET|POST /api/cron/publish` → `{ due, published, requeued, failed, skipped }`

- [ ] **Step 1: Create `lib/cron/auth.ts`**

```ts
// Both cron routes are gated by a bearer secret (spec §6/§14). The external
// trigger (cron-job.org / GitHub Actions) must send:
//   Authorization: Bearer $CRON_SECRET
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // unset secret = closed, never open
  return req.headers.get('authorization') === `Bearer ${secret}`
}
```

- [ ] **Step 2: Write the failing `decideOutcome` tests** — `lib/schedule/publish.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { decideOutcome, type AttemptResult } from './publish'

const ok = (platform: 'x' | 'threads', id: string): AttemptResult => ({ platform, ok: true, id })
const fail = (platform: 'x' | 'threads', error: string, transient: boolean): AttemptResult => ({ platform, ok: false, error, transient })

describe('decideOutcome', () => {
  it('publishes on full success', () => {
    const o = decideOutcome(0, [ok('x', '1'), ok('threads', '2')], {})
    expect(o.status).toBe('published')
    expect(o.externalPostIds).toEqual({ x: '1', threads: '2' })
    expect(o.error).toBeNull()
  })

  it('requeues a transient failure while retries remain', () => {
    const o = decideOutcome(0, [ok('x', '1'), fail('threads', 'rate limited', true)], {})
    expect(o.status).toBe('scheduled') // back in the queue = retry
    expect(o.retryCount).toBe(1)
    expect(o.externalPostIds).toEqual({ x: '1' }) // partial success is preserved
    expect(o.error).toContain('threads')
  })

  it('publishes partially once transient retries are exhausted', () => {
    const o = decideOutcome(2, [fail('threads', 'still down', true)], { x: '1' })
    expect(o.status).toBe('published') // X made it; Threads error recorded
    expect(o.externalPostIds).toEqual({ x: '1' })
    expect(o.error).toContain('threads')
    expect(o.retryCount).toBe(2)
  })

  it('does not retry terminal failures — publishes what succeeded', () => {
    const o = decideOutcome(0, [ok('x', '1'), fail('threads', 'not connected', false)], {})
    expect(o.status).toBe('published') // disconnected platform skipped, not fatal
    expect(o.error).toContain('threads')
  })

  it('fails when nothing succeeded and nothing is retryable', () => {
    const o = decideOutcome(0, [fail('x', 'not connected', false), fail('threads', 'auth expired', false)], {})
    expect(o.status).toBe('failed')
  })

  it('fails after retries are exhausted with zero successes', () => {
    const o = decideOutcome(2, [fail('x', 'still down', true)], {})
    expect(o.status).toBe('failed')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run lib/schedule/publish.test.ts`
Expected: FAIL — cannot resolve `./publish`.

- [ ] **Step 4: Implement `lib/schedule/publish.ts`**

```ts
import { addNotification } from '@/lib/notifications/store'
import { getAccount as getThreadsAccount, getValidAccessToken as getThreadsToken } from '@/lib/threads/store'
import { publishThread } from '@/lib/threads/client'
import {
  ThreadsAuthError,
  ThreadsNotConnectedError,
  ThreadsPostTooLongError,
  ThreadsRateLimitError,
} from '@/lib/threads/errors'
import { getValidAccessToken as getXToken } from '@/lib/x/store'
import { postTweet, uploadImageFromUrl } from '@/lib/x/client'
import { X_MEDIA_SCOPE_ENABLED } from '@/lib/x/oauth'
import { MediaScopeError, PostTooLongError, ReplyNotAllowedError, XAuthError, XNotConnectedError } from '@/lib/x/errors'
import { finishPublish, type PublishOutcome } from './store'
import type { ExternalPostIds, ScheduledPost, SchedulePlatform } from './types'

// The publish executor. Deliberately callable for ONE post so the cron scan can
// be swapped for per-post QStash callbacks later without touching this logic
// (spec §6 upgrade path). The caller must have CLAIMED the post already
// (status='publishing' via claimForPublishing) — this function only publishes
// and records the outcome.

export type AttemptResult = {
  platform: SchedulePlatform
  ok: boolean
  id?: string
  error?: string
  /** true = worth retrying (rate limit, 5xx, network); false = terminal
   *  (disconnected, expired auth, too long) — retrying can't fix it. */
  transient?: boolean
}

/** Pure outcome policy (spec §6b.4-5): retry transient failures up to 2 times,
 *  keep per-platform successes, never fail a post that reached ANY platform. */
export function decideOutcome(retryCount: number, results: AttemptResult[], prior: ExternalPostIds): PublishOutcome {
  const ids: ExternalPostIds = { ...prior }
  const errors: string[] = []
  let transient = false
  for (const r of results) {
    if (r.ok && r.id) ids[r.platform] = r.id
    else if (!r.ok) {
      errors.push(`${r.platform}: ${r.error ?? 'failed'}`)
      if (r.transient) transient = true
    }
  }
  const error = errors.length ? errors.join(' | ') : null
  if (transient && retryCount < 2) {
    return { status: 'scheduled', externalPostIds: ids, error, retryCount: retryCount + 1 }
  }
  if (Object.keys(ids).length > 0) {
    return { status: 'published', externalPostIds: ids, error, retryCount }
  }
  return { status: 'failed', externalPostIds: ids, error: error ?? 'publish failed', retryCount }
}

async function publishToX(post: ScheduledPost): Promise<AttemptResult> {
  try {
    const token = await getXToken(post.userId)
    let mediaIds: string[] | undefined
    const urls = (post.media ?? []).map((m) => m.url).slice(0, 4)
    if (urls.length && X_MEDIA_SCOPE_ENABLED) {
      mediaIds = []
      for (const url of urls) mediaIds.push(await uploadImageFromUrl(token, url))
    }
    const { id } = await postTweet(token, post.content, undefined, mediaIds)
    // Link-in-first-reply: best-effort — a failed reply never fails the post.
    if (post.firstReply?.trim()) {
      await postTweet(token, post.firstReply.trim(), id).catch((e) =>
        console.error('[schedule/publish] first reply failed:', e),
      )
    }
    return { platform: 'x', ok: true, id }
  } catch (err) {
    if (err instanceof XNotConnectedError) return { platform: 'x', ok: false, error: 'X not connected', transient: false }
    if (err instanceof XAuthError) return { platform: 'x', ok: false, error: 'X connection expired — reconnect in Profile', transient: false }
    if (err instanceof MediaScopeError) return { platform: 'x', ok: false, error: 'X media permission missing — reconnect in Profile', transient: false }
    if (err instanceof PostTooLongError) return { platform: 'x', ok: false, error: `too long for X (limit ${err.limit})`, transient: false }
    if (err instanceof ReplyNotAllowedError) return { platform: 'x', ok: false, error: err.message, transient: false }
    console.error('[schedule/publish] X failed:', err)
    return { platform: 'x', ok: false, error: 'X publish failed', transient: true }
  }
}

async function publishToThreads(post: ScheduledPost): Promise<AttemptResult> {
  try {
    const token = await getThreadsToken(post.userId)
    const account = await getThreadsAccount(post.userId)
    if (!account) throw new ThreadsNotConnectedError()
    const imageUrls = (post.media ?? []).map((m) => m.url)
    const { id } = await publishThread(token, account.threadsUserId, post.content, { imageUrls })
    return { platform: 'threads', ok: true, id }
  } catch (err) {
    if (err instanceof ThreadsNotConnectedError) return { platform: 'threads', ok: false, error: 'Threads not connected', transient: false }
    if (err instanceof ThreadsAuthError) return { platform: 'threads', ok: false, error: 'Threads connection expired — reconnect in Profile', transient: false }
    if (err instanceof ThreadsPostTooLongError) return { platform: 'threads', ok: false, error: `too long for Threads (limit ${err.limit})`, transient: false }
    if (err instanceof ThreadsRateLimitError) return { platform: 'threads', ok: false, error: 'Threads rate limit', transient: true }
    console.error('[schedule/publish] Threads failed:', err)
    return { platform: 'threads', ok: false, error: 'Threads publish failed', transient: true }
  }
}

/** Publish ONE already-claimed post. Skips platforms that succeeded on an
 *  earlier attempt (their ids are in externalPostIds). Records the outcome and
 *  notifies on terminal failure. Returns the resulting status. */
export async function publishScheduledPost(post: ScheduledPost): Promise<'published' | 'scheduled' | 'failed'> {
  const prior = post.externalPostIds ?? {}
  const results: AttemptResult[] = []
  for (const platform of post.platforms) {
    if (prior[platform]) continue
    results.push(platform === 'x' ? await publishToX(post) : await publishToThreads(post))
  }
  const outcome = decideOutcome(post.retryCount, results, prior)
  await finishPublish(post.id, outcome)
  if (outcome.status === 'failed') {
    await addNotification({
      userId: post.userId,
      kind: 'publish_failed',
      title: 'a scheduled post failed to publish',
      body: 'open the calendar to see what happened and try again.',
      refId: post.id,
    }).catch((e) => console.error('[schedule/publish] notify failed:', e))
  }
  return outcome.status
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/schedule/publish.test.ts`
Expected: PASS.

- [ ] **Step 6: Create `app/api/cron/publish/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron/auth'
import { publishScheduledPost } from '@/lib/schedule/publish'
import { claimForPublishing, listDuePostIds } from '@/lib/schedule/store'

// Publish cron (spec §6b): scan due posts, claim each atomically, publish.
// Triggered externally (cron-job.org / GitHub Actions) every 1-5 minutes —
// Vercel Hobby crons only run daily, so no vercel.json here.
export const maxDuration = 60

const BATCH_LIMIT = 10

async function run(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const due = await listDuePostIds(BATCH_LIMIT)
  let published = 0
  let requeued = 0
  let failed = 0
  let skipped = 0

  for (const id of due) {
    // Atomic claim: a concurrent run gets null here and skips — no double-publish.
    const post = await claimForPublishing(id)
    if (!post) {
      skipped++
      continue
    }
    try {
      const status = await publishScheduledPost(post)
      if (status === 'published') published++
      else if (status === 'scheduled') requeued++
      else failed++
    } catch (err) {
      // Never leave a claimed row stuck in 'publishing' — requeue it as a retry.
      console.error('[cron/publish] unexpected failure:', err)
      const { finishPublish } = await import('@/lib/schedule/store')
      await finishPublish(post.id, {
        status: post.retryCount < 2 ? 'scheduled' : 'failed',
        externalPostIds: post.externalPostIds ?? {},
        error: 'internal error',
        retryCount: post.retryCount + 1,
      }).catch(() => {})
      failed++
    }
  }

  return NextResponse.json({ due: due.length, published, requeued, failed, skipped })
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
```

> Move the `finishPublish` import to the top of the file with the others — the inline `await import` above is shown only to make the catch-block self-contained; the final code imports it once at the top.

- [ ] **Step 7: Add `CRON_SECRET` to `.env.local`**

Run: `python3 -c "import secrets; print(secrets.token_hex(32))"` and append `CRON_SECRET=<value>` to `.env.local`. (Prod value is set in Vercel in Task 15.)

- [ ] **Step 8: Live-test double-publish safety + happy path**

With the dev server running and an X- or Threads-connected account: schedule a post 1 minute out (Task 8 UI), wait until due, then fire two overlapping cron calls:

```bash
curl -s localhost:3000/api/cron/publish -H "Authorization: Bearer $CRON_SECRET" & \
curl -s localhost:3000/api/cron/publish -H "Authorization: Bearer $CRON_SECRET" & wait
```

Expected: combined results show the post published exactly ONCE (`published: 1` total across both, the other run reports `skipped` or `due: 0`); the platform shows one post; the calendar shows `published`. Also: `curl -s localhost:3000/api/cron/publish` (no header) → 401.

- [ ] **Step 9: Typecheck + all tests, commit**

```bash
npx tsc --noEmit && npm test
git add lib/cron/auth.ts lib/schedule/publish.ts lib/schedule/publish.test.ts app/api/cron/publish
git commit -m "Add publish cron"
```

---

### Task 14: Generation logic + generation cron route

**Files:**
- Create: `lib/autopilot/generate.ts`
- Test: `lib/autopilot/generate.test.ts` (pure `pickInterest` only)
- Create: `app/api/cron/generate/route.ts`

**Interfaces:**
- Consumes: `upcomingSlots` (Task 2), `slotOccupied` (Task 5), `AUTOPILOT_PROMPT` (Task 3), `validateAutopilotPost` (Task 3), `generatePost` from `@/lib/voice/generate`, `listProfiles` + `isVoiceReady`, `listEnabledTexts` from `@/lib/voice/samples`, `deduct`/`refund`/`getBalance`/`resetIfDue` + `COST_PER_AUTO_POST`, `isStaff`, stores from Tasks 4–5, `ModelBusyError` from `@/lib/anthropic`.
- Produces:
  - `pickInterest(interests: string[], slot: Date): string` (pure, deterministic daily rotation)
  - `fillSlot(user: { userId: string; email: string }, settings: AutopilotSettings, slot: Date): Promise<SlotFillResult>` where `SlotFillResult = 'generated' | 'occupied' | 'no_voice' | 'no_platforms' | 'invalid_output' | 'paused_credits'`
  - `GET|POST /api/cron/generate` → `{ users, generated, occupied, skipped, paused }`

- [ ] **Step 1: Write the failing `pickInterest` test** — `lib/autopilot/generate.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { pickInterest } from './generate'

describe('pickInterest', () => {
  const interests = ['ai tools', 'building in public', 'indie revenue']

  it('is deterministic for the same slot', () => {
    const slot = new Date('2026-07-10T09:00:00Z')
    expect(pickInterest(interests, slot)).toBe(pickInterest(interests, slot))
  })

  it('rotates across consecutive days', () => {
    const a = pickInterest(interests, new Date('2026-07-10T09:00:00Z'))
    const b = pickInterest(interests, new Date('2026-07-11T09:00:00Z'))
    const c = pickInterest(interests, new Date('2026-07-12T09:00:00Z'))
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('handles a single interest', () => {
    expect(pickInterest(['ai'], new Date('2026-07-10T09:00:00Z'))).toBe('ai')
  })
})
```

Run: `npx vitest run lib/autopilot/generate.test.ts` — expected FAIL (module missing).

- [ ] **Step 2: Implement `lib/autopilot/generate.ts`**

```ts
import { ModelBusyError } from '@/lib/anthropic'
import { isStaff } from '@/lib/appLock'
import { AUTOPILOT_PROMPT } from '@/lib/autopilotPrompt'
import { COST_PER_AUTO_POST } from '@/lib/creditsConfig'
import { deduct, getBalance, refund, resetIfDue } from '@/lib/credits'
import { addNotification } from '@/lib/notifications/store'
import { slotOccupied } from '@/lib/schedule/conflict'
import { createScheduledPost } from '@/lib/schedule/store'
import type { SchedulePlatform } from '@/lib/schedule/types'
import { getAccount as getThreadsAccount } from '@/lib/threads/store'
import { generatePost } from '@/lib/voice/generate'
import { isVoiceReady } from '@/lib/voice/ready'
import { listEnabledTexts } from '@/lib/voice/samples'
import { listProfiles } from '@/lib/voice/store'
import { getAccount as getXAccount } from '@/lib/x/store'
import { pauseAutopilot, type AutopilotSettings } from './store'
import { validateAutopilotPost } from './validate'

// One autopilot generation = one slot fill. Reuses the EXISTING voice pipeline
// (generatePost) with the autopilot FORMAT prompt (voice spec) — no second
// voice system. Credits go through the existing deduct/refund helpers.

/** Deterministic daily rotation through the user's interests. */
export function pickInterest(interests: string[], slot: Date): string {
  const day = Math.floor(slot.getTime() / 86_400_000)
  return interests[day % interests.length]
}

export type SlotFillResult =
  | 'generated'
  | 'occupied'
  | 'no_voice'
  | 'no_platforms'
  | 'invalid_output'
  | 'paused_credits'

export async function fillSlot(
  user: { userId: string; email: string },
  settings: AutopilotSettings,
  slot: Date,
): Promise<SlotFillResult> {
  // 1. Autopilot only fills EMPTY slots — any non-cancelled post blocks (spec §2/§7).
  if (await slotOccupied(user.userId, slot)) return 'occupied'

  // 2. Only publish to platforms that are actually connected (skip, don't fail).
  const connected: SchedulePlatform[] = []
  for (const p of settings.platforms) {
    if (p === 'x' && (await getXAccount(user.userId))) connected.push('x')
    if (p === 'threads' && (await getThreadsAccount(user.userId))) connected.push('threads')
  }
  if (connected.length === 0) return 'no_platforms'

  // 3. Credit gate (spec §6a.3): never go negative, never silently fail —
  //    pause + notify instead. Staff are unlimited (existing bypass).
  const staff = isStaff(user.email)
  if (!staff) {
    await resetIfDue(user.userId)
    const balance = await getBalance(user.userId)
    if (balance < COST_PER_AUTO_POST) {
      await pauseAutopilot(user.userId, 'insufficient_credits')
      await addNotification({
        userId: user.userId,
        kind: 'autopilot_paused',
        title: 'autopilot paused — not enough credits',
        body: 'top up in billing to get autopilot writing again.',
      }).catch(() => {})
      return 'paused_credits'
    }
  }

  // 4. The voice: the user's first ready profile (same resolution as the composer).
  const profile = (await listProfiles(user.userId)).find(isVoiceReady) ?? null
  if (!profile) return 'no_voice'
  const samples = await listEnabledTexts(user.userId, profile.id, 5)

  // 5. Charge atomically right before generating; refund on ANY failure below
  //    (same pattern as app/api/voice/chat).
  let chargeLedgerId: string | undefined
  if (!staff) {
    const charge = await deduct(user.userId, COST_PER_AUTO_POST, 'post', {
      metadata: { kind: 'autopilot', slot: slot.toISOString() },
    })
    chargeLedgerId = charge.ledgerId
  }

  try {
    const interest = pickInterest(settings.interests, slot)
    const { drafts } = await generatePost({
      idea: `share one specific thought, lesson, or observation from your work related to: ${interest}`,
      voiceProfile: profile,
      samples,
      count: 1,
      formatText: AUTOPILOT_PROMPT,
    })

    const text = drafts[0]?.fullText ?? ''
    const check = validateAutopilotPost(text)
    if (!check.ok) {
      // Empty/garbage output is refunded and skipped — NEVER scheduled (spec §6a.4).
      if (chargeLedgerId) await refund(user.userId, chargeLedgerId).catch(() => {})
      console.warn('[autopilot] invalid output (%s) for user %s — will retry next cycle', check.reason, user.userId)
      return 'invalid_output'
    }

    const post = await createScheduledPost({
      userId: user.userId,
      content: text,
      firstReply: null, // autopilot never carries a link (voice spec)
      platforms: connected,
      scheduledFor: slot,
      timezone: settings.timezone,
      source: 'autopilot',
      creditsCharged: staff ? 0 : COST_PER_AUTO_POST,
      chargeLedgerId: chargeLedgerId ?? null,
    })

    if (settings.reviewBeforePublish) {
      const when = slot.toLocaleString('en-US', {
        timeZone: settings.timezone,
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
      await addNotification({
        userId: user.userId,
        kind: 'autopilot_queued',
        title: 'autopilot queued a post',
        body: `going out ${when} — review or edit it on the calendar first.`,
        refId: post.id,
      }).catch(() => {})
    }
    return 'generated'
  } catch (err) {
    if (chargeLedgerId) await refund(user.userId, chargeLedgerId).catch(() => {})
    // Unique-index race: another cron run filled this slot between the occupancy
    // check and the insert — treat as occupied, credits already refunded.
    if ((err as { code?: string })?.code === '23505') return 'occupied'
    if (err instanceof ModelBusyError) throw err // stop the whole run — model is overloaded
    console.error('[autopilot] generation failed for user %s:', user.userId, err)
    return 'invalid_output'
  }
}
```

- [ ] **Step 3: Run the unit tests**

Run: `npx vitest run lib/autopilot/generate.test.ts`
Expected: PASS.

- [ ] **Step 4: Create `app/api/cron/generate/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { fillSlot } from '@/lib/autopilot/generate'
import { listAutopilotCandidates } from '@/lib/autopilot/store'
import { ModelBusyError } from '@/lib/anthropic'
import { isCronAuthorized } from '@/lib/cron/auth'
import { upcomingSlots } from '@/lib/schedule/slots'

// Generation cron (spec §6a): for each autopilot user, fill upcoming empty
// slots inside their lead-time window. Triggered externally every ~15 min.
// LLM calls are slow (~10-30s), so each run is budgeted: leftover slots are
// picked up by the next run — lead_time (240 min) >> trigger interval.
export const maxDuration = 60

const MAX_GENERATIONS_PER_RUN = 3
const TIME_BUDGET_MS = 45_000

async function run(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const started = Date.now()
  const now = new Date()
  const candidates = await listAutopilotCandidates()
  let generated = 0
  let occupied = 0
  let skipped = 0
  let paused = 0

  outer: for (const { settings, email } of candidates) {
    if (generated >= MAX_GENERATIONS_PER_RUN || Date.now() - started > TIME_BUDGET_MS) break
    if (!settings.interests.length || !settings.postingTimes.length || !settings.platforms.length) {
      skipped++
      continue
    }
    const slots = upcomingSlots(
      { postingTimes: settings.postingTimes, timezone: settings.timezone, slotsPerDay: settings.slotsPerDay },
      now,
      settings.leadTimeMinutes,
    )
    for (const slot of slots) {
      if (generated >= MAX_GENERATIONS_PER_RUN || Date.now() - started > TIME_BUDGET_MS) break outer
      try {
        const result = await fillSlot({ userId: settings.userId, email }, settings, slot)
        if (result === 'generated') generated++
        else if (result === 'occupied') occupied++
        else if (result === 'paused_credits') {
          paused++
          break // stop for this user (spec §6a.3)
        } else skipped++
      } catch (err) {
        if (err instanceof ModelBusyError) {
          console.warn('[cron/generate] model busy — ending run early')
          break outer
        }
        throw err
      }
    }
  }

  return NextResponse.json({ users: candidates.length, generated, occupied, skipped, paused })
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
```

- [ ] **Step 5: Live end-to-end test of the whole autopilot loop**

With the dev server + a voice-ready, platform-connected account:

1. On `/app/autopilot`: interest `building in public`, posting time ~2h from now (inside the 240-min lead), platform, enabled ON, review ON. Save.
2. `curl -s localhost:3000/api/cron/generate -H "Authorization: Bearer $CRON_SECRET"` → `{ generated: 1, ... }`.
3. Verify: lime post on `/app/calendar` at the slot; content is lowercase, no URL/em-dash; bell shows "autopilot queued a post"; `credit_ledger` has a −1000 `post` entry with `metadata.kind='autopilot'` (or none if staff).
4. Re-run the same curl → `{ occupied: 1, generated: 0 }` (slot already filled — idempotent).
5. Manual-wins check: schedule a manual post (Task 8) at the SAME time → the lime post flips to cancelled (gone from calendar), refund row appears in the ledger, violet post takes the slot.
6. Credit-exhaustion check (non-staff test account): set balances to 0 (`UPDATE profiles SET credit_balance=0, topup_balance=0 WHERE user_id='...'`), re-add an empty future slot, run the cron → `{ paused: 1 }`, settings show the paused-for-credits banner, bell shows the paused notification.

- [ ] **Step 6: Typecheck + all tests, commit**

```bash
npx tsc --noEmit && npm test
git add lib/autopilot/generate.ts lib/autopilot/generate.test.ts app/api/cron/generate
git commit -m "Add generation cron"
```

---

### Task 15: External cron wiring + deploy prep

**Files:**
- Create: `.github/workflows/cron.yml`
- Create: `docs/cron-setup.md`

**Interfaces:**
- Consumes: the two cron routes (Tasks 13–14).
- Produces: a committed GitHub Actions fallback trigger + an ops doc. NO `vercel.json` (Hobby plan: crons are daily-only — decision locked with the user).

- [ ] **Step 1: Create `.github/workflows/cron.yml`**

```yaml
# External cron triggers for the scheduling feature. Vercel Hobby crons run at
# most once a day, so the app's two cron routes are triggered from outside.
# GitHub Actions schedules can lag by several minutes — for tighter publish
# timing use cron-job.org (docs/cron-setup.md); this workflow is the always-on
# fallback. Requires repo secrets: APP_URL (e.g. https://<prod-domain>) and
# CRON_SECRET (same value as the Vercel env var).
name: cron
on:
  schedule:
    - cron: '*/5 * * * *' # publish scan
    - cron: '*/15 * * * *' # generation scan (also matched by the 5-min line? no — see step logic)
  workflow_dispatch: {}

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: publish due posts
        run: |
          curl -fsS --max-time 90 "$APP_URL/api/cron/publish" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
      - name: generate autopilot posts (every 3rd run ≈ 15 min)
        if: ${{ github.event_name == 'workflow_dispatch' || endsWith(github.run_number, '0') || endsWith(github.run_number, '3') || endsWith(github.run_number, '6') || endsWith(github.run_number, '9') }}
        run: |
          curl -fsS --max-time 90 "$APP_URL/api/cron/generate" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

> Simplify while implementing: ONE `*/5` schedule; the publish step always runs, and the generate step's `if:` gate above is approximate — an acceptable simpler variant is to just call BOTH endpoints every 5 minutes (the generate route is cheap when there is nothing to do and fully idempotent). Prefer the simple variant; drop the second schedule line and the `if:` gate entirely.

- [ ] **Step 2: Create `docs/cron-setup.md`**

```markdown
# Cron setup (scheduling + autopilot)

The app has two cron endpoints, both gated by `Authorization: Bearer $CRON_SECRET`:

| Endpoint | What it does | Suggested cadence |
| --- | --- | --- |
| `GET /api/cron/publish` | Publishes due scheduled posts (atomic claim, max 10/run, ≤2 retries) | every 1–5 min |
| `GET /api/cron/generate` | Autopilot fills upcoming empty slots (≤3 generations/run) | every 5–15 min |

Vercel plan is **Hobby** → Vercel Cron can only fire once a day, so the triggers are external.

## Primary: cron-job.org (per-minute precision)

1. Create an account at cron-job.org.
2. Add job 1: URL `https://<prod-domain>/api/cron/publish`, schedule every 1 min (or 2 min),
   request method GET, add header `Authorization: Bearer <CRON_SECRET>`, timeout 60s.
3. Add job 2: same, URL `.../api/cron/generate`, schedule every 15 min.

## Fallback: GitHub Actions

`.github/workflows/cron.yml` calls both endpoints every 5 minutes. Set repo secrets
`APP_URL` and `CRON_SECRET`. Note: Actions schedules can lag 3–15 min — fine for
generation, coarse for publishing. Keep cron-job.org as the primary publish trigger.

## Env

- `CRON_SECRET` — long random hex; set in `.env.local`, Vercel project env (Production),
  GitHub repo secrets, and the cron-job.org header. Rotate everywhere at once.

## Upgrade path (not built)

If per-post timing precision ever matters, swap the publish scan for QStash (Upstash)
callbacks scheduled at the exact publish moment: the callback claims the post
(`claimForPublishing`) and calls `publishScheduledPost` — the executor is already
single-post callable, so only the trigger changes.

## Prod rollout checklist

1. Run the schema once against prod: `DATABASE_URL=<prod> npx tsx scripts/sync-schema.ts`
   (`DB_SKIP_SCHEMA=1` means it will NOT self-apply).
2. Set `CRON_SECRET` in Vercel env.
3. `vercel --prod` (manual deploy — this repo does not auto-deploy from git).
4. Create the two cron-job.org jobs; set the GitHub secrets.
5. Fire both endpoints once with curl against prod and check the JSON summaries.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/cron.yml docs/cron-setup.md
git commit -m "Add external cron wiring"
```

---

### Task 16: End-to-end verification pass

**Files:** none new — verification only (fix-forward anything found, committing per fix).

- [ ] **Step 1: Full local gate**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all clean (build also re-runs `gen:prompt` via `prebuild` — confirm `lib/autopilotPrompt.ts` regenerates).

- [ ] **Step 2: Walk the spec's §11 edge cases against the dev server**

- Timezone: schedule a manual post from the browser; confirm `scheduled_for` in the DB is the correct UTC instant for the picked local time; autopilot slot for `Asia/Almaty` `09:00` lands at `04:00Z` (check the row).
- Double-publish: rerun Task 13 Step 8's parallel-curl check.
- Partial platform failure: schedule a post to X + Threads with one platform disconnected → post publishes to the connected one, the other's error is recorded in `error`, status `published`.
- Editing: PATCH a `scheduled` post (works), then try editing a `published` one → 409 with the friendly message in the calendar modal.
- Empty/garbage generation: temporarily set `ANTHROPIC_MODEL` to something invalid → run generate cron → `invalid_output` path: refund row present, no scheduled row, next run retries. Restore the env var.
- Manual fills every slot → generate cron reports `occupied`, creates nothing.
- Credit exhaustion → pause + notify + banner (Task 14 Step 5.6).
- Cancel an unpublished autopilot post from the calendar → refund appears in the ledger.

- [ ] **Step 3: Prod rollout** (follow `docs/cron-setup.md` checklist: prod schema sync → Vercel env → `vercel --prod` → external cron jobs → curl smoke tests)

- [ ] **Step 4: Final commit if fixes were made, then report status honestly** — list anything that failed and was NOT fixed.

---

## Self-review (done at plan-writing time)

- **Spec coverage:** §3.1 onboarding → Task 11; §3.2 schedule button → Task 8; §3.3 calendar → Task 9; §3.4 settings page → Task 10; §3.5 two crons → Tasks 13–14; §4 data model → Task 1 (plus `retry_count`/`charge_ledger_id` additions needed by §6b retries and §7 refunds); §5 endpoints → Tasks 6–7; §6 cron details → Tasks 13–14 (§6b atomic claim = `claimForPublishing`); §7 conflict rule → `lib/schedule/conflict.ts`, used in POST/PATCH (manual side) and `fillSlot` (cron side), one `SLOT_WINDOW_MINUTES` constant; §8 notifications → Tasks 5/7/12 + emitted in 13/14; §9 voice spec → Task 3 verbatim prompt + mechanical validator; §10 UI → Tasks 8–12 with REAL repo tokens (spec's hexes/fonts don't match the codebase — verified discrepancy, team gotcha confirms tokens win); §11 edge cases → Task 16 checklist; §12 defaults → all adopted (review_before_publish=true, slots_per_day=1, lead=240, cost=COST_PER_POST); §13 order preserved modulo stores-before-UI; §14 guardrails → global constraints.
- **Known deviations from the spec (intentional):** LinkedIn omitted (does not exist in the codebase; user confirmed); Vercel Cron replaced by external triggers (Hobby plan; user confirmed); "notify the user" uses a NEW lightweight notifications table because no in-app channel existed (spec §8 explicitly allows this).
- **Type consistency:** `ScheduledPost`/`SchedulePlatform`/`ExternalPostIds` defined once in `lib/schedule/types.ts` and imported everywhere; `AutopilotSettings` once in `lib/autopilot/store.ts`; `PostingTime` once in `lib/schedule/slots.ts`; `parsePlatforms`/`parseMedia` once in `lib/schedule/parse.ts`.
- **Placeholder scan:** every code step carries full code; the two flagged inline notes (route-file helper exports in Task 6, workflow simplification in Task 15) resolve to concrete instructions.





