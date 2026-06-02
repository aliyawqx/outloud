# Outloud

AI build-in-public copilot: turns what you ship into X posts in **your own voice** (or a
chosen style), and writes sharp **replies** to grow your account — not generic AI slop.

## Status

| Part | State |
|---|---|
| Landing + early-access form (X handle + ship) → Neon Postgres + email notify (Resend) | ✅ built, deployed on Render |
| Reply Composer `/reply` — paste a post → 1 witty reply (your voice or a celebrity preset) | ✅ built (Claude) |
| Generation core (`lib/anthropic.ts`) — voice/style + HSO + subtle humor | ✅ built, unit-tested |
| Full MVP (Sign in with X, voice capture, compose sessions) | 📐 designed, not built |

## Stack

Next.js 15 (App Router, TS) · React 19 · PostgreSQL (Neon) · Anthropic Claude (Sonnet 4.6, swappable via `ANTHROPIC_MODEL`) · Resend (email) · Vitest · deployed on Render.

## Structure

```
app/
  page.tsx                 landing
  reply/page.tsx           Reply Composer page
  api/early-access/route   waitlist signup → DB + email
  api/reply/route          generate a reply
components/                landing sections + reply/ReplyComposer
lib/
  anthropic.ts             Claude: captureVoice + generateDrafts (HSO, hook intensity, subtle humor)
  styles.ts                celebrity style presets (e.g. Elon)
  validateReply.ts         reply input validation
  validateSignup.ts        waitlist validation
  db.ts / notify.ts        Postgres + Resend
docs/superpowers/          specs & plans (see below)
```

## Run locally

```bash
npm install
cp .env.example .env.local   # fill the keys
npm run dev                  # http://localhost:3000
npm test                     # unit tests (Claude mocked — no API cost)
```

## Env vars

- `DATABASE_URL` — Postgres (Neon)
- `RESEND_API_KEY`, `NOTIFY_EMAIL` — signup email notifications
- `ANTHROPIC_API_KEY` — generation; optional `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`)

## Deploy

Render web service from `github.com/aliyawqx/outloud` (build `npm run build`, start `npm start`); Neon for Postgres; set the env vars above in Render.

## Design docs

- Landing: `docs/superpowers/specs/2026-05-30-outloud-landing-design.md`
- MVP (full product): `docs/superpowers/specs/2026-06-01-outloud-mvp-design.md`
- Reply Composer: `docs/superpowers/specs/2026-06-01-reply-composer-design.md`
- Plans: `docs/superpowers/plans/` (landing, MVP phase 1 auth)
