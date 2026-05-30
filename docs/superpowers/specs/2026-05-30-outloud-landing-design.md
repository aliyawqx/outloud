# Outloud — Landing Page Design Spec

**Date:** 2026-05-30
**Status:** Approved (design), pending implementation plan

## Goal

Build a single-page landing for **Outloud** that:
1. Explains the product and its features.
2. Captures a waitlist of people interested in the product.
3. Distinguishes "just curious" from "ready to pay" by collecting willingness-to-pay.

This serves the strategic goal: validate that real indie SaaS founders will pay $50–100/mo.

## Product One-liner

AI build-in-public copilot that turns what you ship into X posts in your voice — not an AI voice.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Language | English |
| Stack | Next.js (App Router) + Tailwind |
| Email backend | Own backend on Railway (Next.js API route + Postgres) |
| Form data | Email + willingness-to-pay selector |
| Visual style | Build-in-public / X-native (dark theme, X-post mockups, personal tone) |

## Architecture

Single Next.js project, deployed on Railway as one service; Postgres as a separate Railway plugin.

```
outloud/
├─ app/
│  ├─ page.tsx              # landing (all sections)
│  ├─ layout.tsx            # fonts, meta, OG tags
│  └─ api/waitlist/route.ts # POST: validate + write to Postgres
├─ components/              # Hero, HowItWorks, Differentiators, Thesis, WaitlistForm, ...
├─ lib/db.ts                # Postgres connection
└─ ...
```

- **Frontend:** Next.js + Tailwind, dark X-native theme.
- **Backend:** single API route `POST /api/waitlist`.
- **DB:** Postgres on Railway, one table.

## Data Model

Table `waitlist_signups`:

| field | type | notes |
|---|---|---|
| `id` | serial PK | |
| `email` | text, unique | primary contact key |
| `willingness_to_pay` | int | 0 / 10 / 50 / 100 / 101 (=$100+) |
| `referrer` | text, nullable | acquisition channel (analytics) |
| `created_at` | timestamptz | default now() |

Duplicate email → not an error. Upsert by email: update `willingness_to_pay` if it changed, respond "You're already on the list."

## Landing Content (page sections)

1. **Hero** — headline: *"Ship in public. Sound like you — not like AI."* Subhead about turning what you ship into X posts in your voice. CTA → form.
2. **The pain** — Jack's story: 3 likes → demotivation → six months of silence → −$6.4k MRR. Hits the target audience's pain.
3. **How it works** — 4 steps: capture voice from 5+ posts → input (changelog/idea) → 1–2 drafts in your voice → approve in 30s → autopost to X.
4. **Why it's different** — three "nots": not Buffer/Typefully (scheduler for already-written), not ChatGPT (generic mush), not AI-avatars (slop). Visual: two X-post mockups side by side — "AI-slop" vs "your voice".
5. **The 2029 thesis** — manifesto: the internet drowns in AI-slop → an authentic real human voice becomes premium.
6. **Pricing hint** — "$50–100/mo at launch".
7. **Waitlist form** — email + selector "How much would you pay/mo?" ($0 / $10 / $50 / $100 / $100+). After submit — thank-you state.
8. **Footer** — minimal.

## Error Handling

- **Form:** client-side email validation; loading / success / error states. Duplicate → friendly "You're already on the list."
- **API:** server-side validation of email and willingness; reject empty/garbage values; correct response when DB is unavailable.

## Testing (TDD)

API route tests:
- valid submission
- invalid email
- duplicate (upsert behavior)
- invalid willingness value

## Out of Scope (YAGNI)

- Scheduling, multi-platform, team features, auto-post-without-approval (those are post-MVP product features, not landing concerns).
- Email confirmation / double opt-in (can add later).
- Admin dashboard (read signups directly from Railway Postgres for now).
