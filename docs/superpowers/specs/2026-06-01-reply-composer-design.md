# Outloud — Reply Composer — Design Spec

**Date:** 2026-06-01
**Status:** Approved (design), pending implementation plan

## Goal

A standalone, usable-now feature: the founder pastes the text of a popular X post,
and Outloud generates one witty reply in their voice (subtle double-meaning humor) — the
reply-guy growth move. No X search, no login, no DB in v1.

## Locked Decisions

| Decision | Choice |
|---|---|
| Post source | **Manual paste** of the post text. No X API, no scraper, no link-fetch (those need paid/grey access). |
| Auth / storage | **None in v1.** The founder's voice samples live in `localStorage`. Folds under auth + DB later. |
| Generation | Reuses `generateDrafts(profile, { kind: 'reply', ... })` from `lib/anthropic.ts`. |
| Output | **1 reply draft**, subtle-humor on by default, hook intensity selectable. |
| Cost note | Built + unit-tested with Claude mocked (free). Live API calls are the user's spend. |

## Architecture

A new route `/reply` in the existing Next.js app, styled with the current design system.
Client page holds voice samples (localStorage) and the reply form; a thin API route runs
the generation server-side (keeps `ANTHROPIC_API_KEY` off the client).

```
app/
├─ reply/page.tsx                 # standalone page (no auth in v1)
└─ api/reply/route.ts             # POST: validate → generateDrafts(kind:'reply') → { draft }
components/
└─ reply/ReplyComposer.tsx        # client: voice (localStorage) + form + result + copy
lib/
├─ validateReply.ts               # pure input validation (+ test)
└─ anthropic.ts                   # existing — generateDrafts(kind:'reply')
```

## Data Flow

1. **Voice setup (once):** founder pastes 5+ of their own posts → saved to `localStorage` (`outloud.voiceSamples`).
2. **Compose:** founder pastes the target post text; optionally adds an angle, picks hook intensity (`safe`/`bold`/`spicy`), toggles subtle humor.
3. **Generate:** `POST /api/reply` with `{ samples, replyTo, angle?, hookIntensity?, subtleHumor? }`.
4. Route calls `generateDrafts({ summary: '', samples }, { kind: 'reply', replyTo, input: angle, hookIntensity, subtleHumor, count: 1 })` and returns `{ draft }` (the first draft).
5. UI shows the reply with a **Copy** button.

(v1 skips `captureVoice` to keep it one API call per reply — the samples act as few-shot anchors directly; `summary` is empty.)

## Validation (`lib/validateReply.ts`)

`validateReplyInput(body)` returns `{ ok: true, value } | { ok: false, error }`:
- `samples`: array of non-empty strings, **≥1** required (each trimmed; drop empties), cap each ≤ 1000 chars.
- `replyTo`: required non-empty string, ≤ 2000 chars.
- `angle`: optional string, ≤ 500 chars.
- `hookIntensity`: optional, one of `safe` | `bold` | `spicy` (default `bold`).
- `subtleHumor`: optional boolean (default `true`).

## Error Handling

- Invalid input → `400` with the validation message.
- `ANTHROPIC_API_KEY` missing or Claude error/timeout → `500` with "Couldn't generate a reply. Try again." (never crash).
- Generation returns no drafts → `500` same friendly message.
- Client: loading / error states; disable button while generating; friendly empty-voice prompt ("paste 5+ of your posts first").

## Testing (TDD, Claude mocked — no spend)

- `validateReply.test.ts`: valid input; missing/empty samples → fail; missing `replyTo` → fail; bad `hookIntensity` → fail; over-length → fail; defaults applied.
- `app/api/reply` route test with `generateDrafts` mocked: happy path returns `{ draft }`; invalid body → 400; generation throw → 500.

## Out of Scope (YAGNI)

X search / auto-discovery of posts; fetching a post from its URL; multi-reply batches;
saving replies to a DB; auth (all deferred — `/reply` moves under the MVP's auth + voice
persistence once those phases land).
