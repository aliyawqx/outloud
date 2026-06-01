# Outloud MVP — Design Spec

**Date:** 2026-06-01
**Status:** Approved (design), pending implementation plan

## Goal

Build the Outloud MVP: a self-serve web app where an indie SaaS founder signs in with X,
captures their voice from past posts, and turns what they ship into X posts that sound
like them — structured as Hook → Story → Offer, refined in an iterative chat session, and
delivered in concierge mode (copy → open X to post). Modeled on Spiral
(writewithspiral.com), specialized for build-in-public X posts.

## Locked Decisions

| Decision | Choice |
|---|---|
| X integration | **Concierge mode** — no paid X API. Delivery = "copy + open X intent" link; user posts manually, then marks as posted. No real autopost, no metrics pull. |
| Users | **Self-serve, multi-user.** Each founder has their own account + voice. |
| Auth | **Sign in with X** via Auth.js (NextAuth), JWT sessions; upsert our own `users` row on sign-in. |
| LLM | **Anthropic Claude API** — Sonnet 4.6 default for generation; Opus 4.8 swappable. |
| Stack | Existing Next.js 15 (App Router, TS) app + PostgreSQL (`pg`), reuse design system. |
| Core model | **Spiral-style**: voice capture (style matching) → multi-angle generation → iterative chat refine session. |
| Post structure | **Hook → Story → Offer (HSO)** baked into the generation system prompt. |
| Hook intensity | Setting `safe` / `bold` (default) / `spicy`. Bold/punchy phrasing, **but not fabricated facts** (authenticity is the moat). |

## Architecture

Build into the existing app on Railway + Postgres. Reuse the landing's CSS design system
(tokens, primitives) for the authenticated app UI.

```
app/
├─ (app)/                      # authenticated area (redirects to sign-in if no session)
│  ├─ voice/page.tsx           # capture / edit voice samples + style notes
│  ├─ compose/page.tsx         # session: input → angles → chat refine → approve
│  └─ history/page.tsx         # past drafts/posts + status
├─ api/
│  ├─ auth/[...nextauth]/route.ts   # Auth.js (X provider)
│  ├─ voice/route.ts                # save samples + (re)build voice profile
│  ├─ generate/route.ts             # idea → multi-angle HSO drafts
│  ├─ refine/route.ts               # chat turn: refine a draft
│  └─ drafts/route.ts               # status transitions (approve/post/discard)
lib/
├─ auth.ts          # NextAuth config (X provider, session callbacks)
├─ anthropic.ts     # Claude client + prompt builders (voice fingerprint, HSO generation, refine)
├─ db.ts            # extend: users, voice_samples, voice_profiles, drafts
└─ xintent.ts       # build https://x.com/intent/post?text=... links
```

## Data Model (Postgres)

- `users` (id serial PK, x_id text unique, handle text, name text, avatar_url text, created_at timestamptz)
- `voice_samples` (id serial PK, user_id FK, text text, created_at timestamptz)
- `voice_profiles` (user_id PK/FK, fingerprint text, summary text, style_notes text, updated_at timestamptz)
- `sessions_compose` (id serial PK, user_id FK, input text, hook_intensity text, created_at timestamptz)
- `drafts` (id serial PK, session_id FK, user_id FK, angle text, hook text, story text, offer text, full_text text, status text[generated|approved|posted|discarded], created_at, posted_at)
- `messages` (id serial PK, session_id FK, draft_id FK nullable, role text[user|assistant], content text, created_at) — chat refine turns

(Auth.js JWT strategy → no adapter tables; `users` upserted in the sign-in callback.)

## User Flows

1. **Sign in with X** → upsert `users` → land in app. Unauthenticated users hitting `(app)` routes redirect to sign-in.
2. **Voice capture** (gate for generation): paste ≥5 of your own posts (+ optional style notes) → save `voice_samples` → "build my voice" → Claude extracts a `fingerprint` + `summary` → stored in `voice_profiles`. Generation is blocked until ≥5 samples and a built profile exist.
3. **Compose session**: enter a changelog/idea + pick hook intensity → `/api/generate` → Claude returns **2–3 angle drafts**, each a full HSO post in the user's voice → shown with the Hook/Story/Offer parts visible.
4. **Refine (chat)**: pick a draft → send refine instructions ("shorter", "punchier hook", "add the number") → `/api/refine` returns an updated draft; turns saved to `messages`. Iterate freely.
5. **Approve + deliver**: approve a draft → status `approved` → "post to X" opens an X intent link prefilled with `full_text` → user posts → marks `posted` (status + `posted_at`).
6. **History**: list sessions/drafts with status; re-open or copy any.

## Generation Design

- **Voice fingerprint** (`lib/anthropic.ts`): one Claude call analyzes the samples → returns a structured style summary (cadence, lowercase/caps, emoji use, sentence length, recurring tics, what they'd never say). Stored as `fingerprint`/`summary`.
- **HSO generation**: system prompt = voice profile + few-shot samples + HSO rules + anti-slop principles ("no AI-isms, no rhetorical questions, concrete details, active voice") + hook-intensity guidance. One call returns 2–3 angles as structured JSON `{ angle, hook, story, offer }`; `full_text` is assembled.
- **Hook intensity**: `safe` = straight/informative; `bold` (default) = curiosity-gap, contrarian, emotional; `spicy` = maximally provocative — **all kept plausibly true, never fabricated facts**.
- **Refine**: system prompt keeps voice + HSO; user message = the current draft + instruction → returns a revised draft.

## Error Handling

- OAuth failures → friendly sign-in error.
- Claude API errors/timeouts/rate limits → user-facing "try again", one retry; never crash the route.
- Validation: ≥5 voice samples before generating; non-empty input; per-post length kept tweet-appropriate (≤280 unless thread); reject malformed JSON.
- DB errors → graceful 500 with a retry-safe message.
- Generation JSON parsing: tolerant parse; if the model returns malformed structure, retry once with a stricter instruction.

## Testing (TDD)

Unit-test pure logic (no live LLM calls — Claude mocked):
- voice-fingerprint prompt builder
- HSO generation prompt builder (includes intensity + anti-slop rules)
- generation response parser (well-formed + malformed → retry path)
- X-intent URL builder (encoding, length)
- draft status-transition validation
- voice-sample validation (min count, length)

API route tests with a mocked Claude client: `/api/generate`, `/api/refine`, `/api/voice` (happy + error paths).

## Build Phases

1. **Auth + shell** — Auth.js Sign in with X, `users` table, protected `(app)` routes, app nav using the design system.
2. **Voice** — samples CRUD + "build my voice" (Claude fingerprint), gate.
3. **Generation + refine** — compose session, multi-angle HSO generation, chat refine.
4. **Delivery + history** — X-intent posting, status transitions, history view.
5. **(Light) manual analytics** — optional per-post manual metric entry. May be deferred.

## Out of Scope (YAGNI)

Real X autopost; real analytics/metrics pull (paid X API); scheduling; multi-platform
(LinkedIn/Threads); team workspaces; PDF/file context grounding; CLI; billing.

## Required Env / Keys

- X OAuth app: `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET` (+ callback URL)
- `ANTHROPIC_API_KEY`
- `AUTH_SECRET` (NextAuth)
- `DATABASE_URL` (already used by the landing)
