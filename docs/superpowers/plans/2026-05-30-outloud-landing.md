# Outloud Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page Next.js landing for Outloud with a waitlist form that captures email + willingness-to-pay into Postgres.

**Architecture:** Next.js App Router app, deployed on Railway as one service with a Postgres plugin. Tailwind for the dark X-native UI. A single `POST /api/waitlist` route validates input and upserts into a `waitlist_signups` table.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, `pg` (node-postgres), Vitest for API tests.

**Note:** Do NOT commit anything (per user request). Skip all `git commit` steps.

---

### Task 1: Scaffold Next.js + Tailwind

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1:** Init project with `npm init -y`, install deps:
  `npm i next@15 react react-dom pg` and `npm i -D typescript @types/react @types/node @types/pg tailwindcss postcss autoprefixer vitest`
- [ ] **Step 2:** Configure Tailwind (`tailwind.config.ts` content globs `./app/**/*.{ts,tsx}`, `./components/**/*.{ts,tsx}`), `postcss.config.mjs`, `app/globals.css` with `@tailwind base/components/utilities` and dark base background.
- [ ] **Step 3:** Minimal `app/layout.tsx` (html/body, dark bg, font) and placeholder `app/page.tsx` returning `<main>Outloud</main>`.
- [ ] **Step 4:** Add scripts to package.json: `dev`, `build`, `start`, `test` (vitest).
- [ ] **Step 5:** Run `npm run build` — expect success.

---

### Task 2: Database layer

**Files:**
- Create: `lib/db.ts`
- Create: `db/schema.sql`

- [ ] **Step 1:** `db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  willingness_to_pay INT NOT NULL,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2:** `lib/db.ts` — a singleton `pg.Pool` from `process.env.DATABASE_URL`, plus:
  - `ensureSchema()` — runs `db/schema.sql`.
  - `upsertSignup({ email, willingnessToPay, referrer })` — `INSERT ... ON CONFLICT (email) DO UPDATE SET willingness_to_pay = EXCLUDED.willingness_to_pay RETURNING (xmax = 0) AS inserted`. Returns `{ alreadyOnList: boolean }`.

---

### Task 3: Waitlist API route (TDD)

**Files:**
- Create: `lib/validateSignup.ts`
- Test: `lib/validateSignup.test.ts`
- Create: `app/api/waitlist/route.ts`

Pure validation extracted so it's unit-testable without a DB.

- [ ] **Step 1: Write failing tests** `lib/validateSignup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateSignup } from './validateSignup'

describe('validateSignup', () => {
  it('accepts a valid signup', () => {
    expect(validateSignup({ email: 'a@b.com', willingnessToPay: 50 }))
      .toEqual({ ok: true, value: { email: 'a@b.com', willingnessToPay: 50 } })
  })
  it('rejects an invalid email', () => {
    expect(validateSignup({ email: 'nope', willingnessToPay: 50 }).ok).toBe(false)
  })
  it('rejects a missing email', () => {
    expect(validateSignup({ willingnessToPay: 50 }).ok).toBe(false)
  })
  it('rejects a willingness value not in the allowed set', () => {
    expect(validateSignup({ email: 'a@b.com', willingnessToPay: 33 }).ok).toBe(false)
  })
  it('accepts each allowed willingness value', () => {
    for (const w of [0, 10, 50, 100, 101]) {
      expect(validateSignup({ email: 'a@b.com', willingnessToPay: w }).ok).toBe(true)
    }
  })
  it('lowercases and trims the email', () => {
    const r = validateSignup({ email: '  A@B.com ', willingnessToPay: 0 })
    expect(r.ok && r.value.email).toBe('a@b.com')
  })
})
```

- [ ] **Step 2:** Run `npm test` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `lib/validateSignup.ts`:

```ts
const ALLOWED = new Set([0, 10, 50, 100, 101])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SignupInput = { email?: unknown; willingnessToPay?: unknown }
export type SignupValue = { email: string; willingnessToPay: number }
export type ValidationResult =
  | { ok: true; value: SignupValue }
  | { ok: false; error: string }

export function validateSignup(input: SignupInput): ValidationResult {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Invalid email' }
  const w = input.willingnessToPay
  if (typeof w !== 'number' || !ALLOWED.has(w)) return { ok: false, error: 'Invalid willingness value' }
  return { ok: true, value: { email, willingnessToPay: w } }
}
```

- [ ] **Step 4:** Run `npm test` — expect PASS.
- [ ] **Step 5: Implement route** `app/api/waitlist/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { validateSignup } from '@/lib/validateSignup'
import { ensureSchema, upsertSignup } from '@/lib/db'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const result = validateSignup((body ?? {}) as any)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const referrer = req.headers.get('referer')
  try {
    await ensureSchema()
    const { alreadyOnList } = await upsertSignup({ ...result.value, referrer })
    return NextResponse.json({ ok: true, alreadyOnList })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
```

---

### Task 4: Landing UI components

**Files:**
- Create: `components/Hero.tsx`, `components/Pain.tsx`, `components/HowItWorks.tsx`, `components/Differentiators.tsx`, `components/Thesis.tsx`, `components/Pricing.tsx`, `components/WaitlistForm.tsx`, `components/Footer.tsx`, `components/XPostMock.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1:** Build each section component per the spec content (English copy). Dark X-native theme.
- [ ] **Step 2:** `XPostMock.tsx` — a reusable styled fake X post (avatar, handle, body) used in Differentiators for "AI-slop" vs "your voice".
- [ ] **Step 3:** `WaitlistForm.tsx` — client component (`'use client'`): email input + willingness selector ($0/$10/$50/$100/$100+ → 0/10/50/100/101), POSTs to `/api/waitlist`, shows loading/success/error/"already on list" states.
- [ ] **Step 4:** Compose all sections in `app/page.tsx` in order: Hero, Pain, HowItWorks, Differentiators, Thesis, Pricing, WaitlistForm, Footer.
- [ ] **Step 5:** Run `npm run build` — expect success.

---

### Task 5: Railway config

**Files:**
- Create: `.env.example`, `.gitignore`, `README.md`

- [ ] **Step 1:** `.env.example` with `DATABASE_URL=`.
- [ ] **Step 2:** `.gitignore` (node_modules, .next, .env*).
- [ ] **Step 3:** `README.md` — run locally, env vars, Railway deploy notes (add Postgres plugin → `DATABASE_URL` auto-injected; build `npm run build`, start `npm start`).

---

## Self-Review

- **Spec coverage:** language=EN ✓ (copy), Next.js+Tailwind ✓ (T1), own backend+Postgres ✓ (T2,T3), email+willingness selector with $10 added ✓ (T3,T4), X-native style ✓ (T4), upsert on duplicate ✓ (T2), error handling ✓ (T3 route, T4 form states), tests ✓ (T3). Out-of-scope items excluded.
- **Type consistency:** `willingnessToPay` / `willingness_to_pay`, `upsertSignup` returns `{ alreadyOnList }`, allowed set `{0,10,50,100,101}` consistent across validate, form, schema.
- **Placeholders:** none.
