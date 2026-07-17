# Zero-Touch Autopilot + Published-Post Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make topic-driven zero-touch autopilot the default experience (Change A) and capture + surface a live permalink for every published post (Change B) — a patch on top of the shipped scheduler + LinkedIn features, rebuilding nothing.

**Architecture:** Change A flips one default (`review_before_publish` → false, DDL + store + onboarding), rewrites onboarding step 4 to the topic-first path, upgrades topic rotation from per-day to per-slot (pure `slotRankInDay` helper), and adds a low-credit warning (new notification kind, 72h dedupe) plus a documented no-op auto-topup hook in the generation cron's credit gate. Change B adds a `permalinks` jsonb column, threads a `permalink` through `AttemptResult`/`decideOutcome`/`finishPublish` (X constructed with handle, LinkedIn constructed from the urn, Threads FETCHED via `getPermalink`), adds a `post_published` success notification with a clickable `link` (new nullable column on `notifications`), and renders live links in the calendar's post modal + the bell.

**Tech Stack:** existing scheduler/LinkedIn modules only; no new dependencies.

## Global Constraints

- Don't rebuild crons, generation, billing, or connection storage — a default flip, a warning, link capture/surfacing (spec Guardrails).
- Zero-touch still HARD-pauses at zero credits (never negative, never silent) — the warning reduces frequency, doesn't remove the stop.
- Threads permalink is **fetched** (`GET /{media-id}?fields=permalink` via existing `getPermalink(token, id)` in `lib/threads/client.ts:44`), never constructed.
- X permalink: `https://x.com/{handle}/status/{id}` when the handle is known (it is — `getAccount`), else `https://x.com/i/status/{id}`.
- LinkedIn permalink: `https://www.linkedin.com/feed/update/{urn}/` from the raw urn already stored in `external_post_ids.linkedin`.
- Only `published` posts carry permalinks; partial failure stores links only for succeeded platforms.
- Voice spec / no-CTA / no-URL rules for autopilot content unchanged.
- Topic rotation: round-robin across SLOTS (decision point default), deterministic, single topic → always that topic.
- Repo conventions unchanged: DDL appended idempotently to `SCHEMA_SQL` (lib/db.ts) + mirrored in db/schema.sql + applied via `npx tsx scripts/sync-schema.ts`; TDD for pure logic; commits English ≤5 words; `npx tsc --noEmit && npm test` before each commit; product copy short/lowercase-friendly, no internals.

## Decisions locked

- Low-credit threshold: `LOW_CREDIT_POSTS_LEFT = 5` (warn when balance < 5 × COST_PER_AUTO_POST and autopilot can still post); dedupe = no second `low_credits` notification within 72h.
- Auto-topup hook: `lib/autopilot/autoTopup.ts` — a documented seam called before the warning; returns `false` today (Polar off-session charging isn't wired; a real implementation needs saved-payment charging, out of scope per "optional hook"). No UI, no column until it can actually charge.
- Success-notification links: add nullable `link TEXT` to `notifications`; the bell renders a notification with `link` as an external anchor. Body lists all platform URLs as text; `link` = the first permalink.
- `review_before_publish` flip applies to NEW rows + the no-row defaults; existing rows keep their stored value (only ALTER the column DEFAULT — no data migration).
- Onboarding step 4: fields = topic(s) + time + timezone only; autopilot turns ON when the user continues with ≥1 topic; the review toggle lives in `/app/autopilot` settings only. Copy states plainly that no login is needed (both crons are server-side).
- Optional "published history" view: NOT built (optional in spec; the calendar month/week views already list published posts with links via the modal).

---

### Task 1: Schema — permalinks, notifications.link, review default flip

**Files:**
- Modify: `lib/db.ts` (SCHEMA_SQL) + `db/schema.sql` (mirror)

**Interfaces:**
- Produces: `scheduled_posts.permalinks JSONB` (nullable), `notifications.link TEXT` (nullable), `autopilot_settings.review_before_publish` DEFAULT false.

- [ ] **Step 1:** In BOTH `lib/db.ts` (inside SCHEMA_SQL) and `db/schema.sql`:
  1. In the `autopilot_settings` CREATE TABLE line change `review_before_publish BOOLEAN NOT NULL DEFAULT true` → `DEFAULT false`, and append after that table's block:
```sql
-- Zero-touch addendum: review-before-publish is now opt-in (default off).
ALTER TABLE autopilot_settings ALTER COLUMN review_before_publish SET DEFAULT false;
```
  2. Append after the `scheduled_posts` indexes block:
```sql
-- Live links to published posts, keyed by platform (zero-touch addendum).
-- Only 'published' posts carry these; populated by the publish cron.
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS permalinks JSONB;
```
  3. Append after the `notifications` index:
```sql
-- Optional tap-through URL (e.g. the live post) rendered as a link in the bell.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
```
- [ ] **Step 2:** `npx tsc --noEmit && npx tsx scripts/sync-schema.ts` (expect `schema synced`); verify the two columns exist via a tsx one-liner against information_schema.
- [ ] **Step 3:** Commit `Add permalinks link columns`.

---

### Task 2: Zero-touch defaults + topic-first onboarding

**Files:**
- Modify: `lib/autopilot/store.ts` (`defaults()`: `reviewBeforePublish: false`)
- Modify: `components/app/VoiceOnboarding.tsx` (step 4 rewrite)

**Interfaces:**
- Consumes: `PUT /api/autopilot` (unchanged; simply omit `reviewBeforePublish` so the DDL default applies to new rows).

- [ ] **Step 1:** `lib/autopilot/store.ts` `defaults()`: `reviewBeforePublish: true` → `false`, with a comment `// zero-touch default (addendum): publish without a review gate`.
- [ ] **Step 2:** Rewrite onboarding step 4 in `components/app/VoiceOnboarding.tsx`:
  - Remove the `apEnabled`/`apReview` state + both checkboxes.
  - `finishOnboarding(false)` sends `{ interests, postingTimes: [{ time: apTime }], timezone: apTimezone, platforms: ['x','threads','linkedin'], enabled: interests.length > 0 }` — NO `reviewBeforePublish` field.
  - Copy (lowercase-friendly, truthful): heading **"Put your posting on autopilot"**; sub `"give it a topic and a time — outloud writes and publishes in your voice on its own. it runs on our servers: no login needed, ever."`; primary button `Start autopilot` (disabled while `apInterests` parses to zero topics, spinner while busy); secondary link `skip for now — you can set this up later in Autopilot` unchanged.
  - Keep the interests comma input, time input, timezone select exactly as they are.
- [ ] **Step 3:** `npx tsc --noEmit && npm test && npm run build`; commit `Make zero-touch autopilot default`.

---

### Task 3: Topic rotation across slots (TDD)

**Files:**
- Modify: `lib/schedule/slots.ts` (+`slotRankInDay`), `lib/schedule/slots.test.ts`
- Modify: `lib/autopilot/generate.ts` (`pickInterest` ordinal), `lib/autopilot/generate.test.ts`

**Interfaces:**
- Produces: `slotRankInDay(cfg: SlotConfig, slot: Date): number` (0-based rank of the instant among the day's quota slots; 0 when not matched); `pickInterest(interests: string[], slot: Date, slotOrdinal?: number): string` where `slotOrdinal = dayNumber * slotsPerDay + rank` (backward-compatible: omitted → old day-based rotation).

- [ ] **Step 1 (RED):** tests —
  - `slots.test.ts`: for `{ postingTimes: [{time:'09:00'},{time:'18:00'}], timezone:'Asia/Almaty', slotsPerDay: 2 }`: rank of the 04:00Z instant is 0, of 13:00Z is 1; unmatched instant → 0; `slotsPerDay:1` caps rank at 0 even for the 18:00 slot.
  - `generate.test.ts`: with 2 topics and 2 slots/day, consecutive ordinals `(day*2+0, day*2+1, (day+1)*2+0…)` produce alternating topics (no repeat between the same day's two slots); omitted ordinal falls back to day-based rotation (existing tests stay green).
- [ ] **Step 2 (GREEN):** implement —
  - `slotRankInDay`: compute the slot's local calendar day via `dateInTz`, rebuild that day's quota list exactly like `upcomingSlots` does (same time-parse + weekday filter + sort + `slice(0, quota)`), return `findIndex` by timestamp, `Math.max(0, idx)`.
  - `pickInterest(interests, slot, slotOrdinal?)`: `const n = slotOrdinal ?? Math.floor(slot.getTime() / 86_400_000); return interests[n % interests.length]` (guard `interests.length` — return `''`-safe only via existing route essentials gate; keep behavior).
  - `fillSlot` call site: `pickInterest(settings.interests, slot, Math.floor(slot.getTime() / 86_400_000) * settings.slotsPerDay + slotRankInDay({ postingTimes: settings.postingTimes, timezone: settings.timezone, slotsPerDay: settings.slotsPerDay }, slot))`.
- [ ] **Step 3:** full gate; commit `Rotate topics across slots`.

---

### Task 4: Low-credit warning + auto-topup hook

**Files:**
- Create: `lib/autopilot/autoTopup.ts`
- Modify: `lib/autopilot/generate.ts` (credit gate), `lib/creditsConfig.ts` (+`LOW_CREDIT_POSTS_LEFT = 5`), `lib/notifications/store.ts` (kind `low_credits`), `components/app/NotificationsBell.tsx` (icon `account_balance_wallet`, not red)

**Interfaces:**
- Produces: `maybeAutoTopup(userId: string): Promise<boolean>`; `hasRecentNotification(userId: string, kind: NotificationKind, withinMs: number): Promise<boolean>` (in `lib/notifications/store.ts`).

- [ ] **Step 1:** `lib/autopilot/autoTopup.ts`:
```ts
// Auto-topup seam (zero-touch addendum). Polar can't charge off-session today
// (one-time checkouts require the user present), so this is a documented no-op
// hook: when saved-payment charging lands, wire it HERE and the generation
// cron's credit gate picks it up with no other changes.
export async function maybeAutoTopup(_userId: string): Promise<boolean> {
  return false
}
```
- [ ] **Step 2:** `lib/notifications/store.ts`: kind union += `'low_credits'`; add
```ts
/** Dedupe helper: was a notification of this kind created recently? */
export async function hasRecentNotification(userId: string, kind: NotificationKind, withinMs: number): Promise<boolean> {
  await ensureSchema()
  const r = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications
     WHERE user_id = $1 AND kind = $2 AND created_at > now() - make_interval(secs => $3)`,
    [userId, kind, Math.floor(withinMs / 1000)],
  )
  return Number(r.rows[0]?.n ?? '0') > 0
}
```
- [ ] **Step 3:** `lib/creditsConfig.ts`: `export const LOW_CREDIT_POSTS_LEFT = 5` (comment: warn before autopilot runs dry — addendum Change A.4).
- [ ] **Step 4:** in `fillSlot`'s credit gate (non-staff branch), AFTER the hard-pause check passes (balance ≥ COST), add:
```ts
    // Never stall silently (addendum A.4): warn while autopilot can still post,
    // so the hard pause at zero rarely happens. Auto-topup hook first.
    if (balance < COST_PER_AUTO_POST * LOW_CREDIT_POSTS_LEFT) {
      const topped = await maybeAutoTopup(user.userId)
      if (!topped && !(await hasRecentNotification(user.userId, 'low_credits', 72 * 3_600_000))) {
        await addNotification({
          userId: user.userId,
          kind: 'low_credits',
          title: 'autopilot is running low on credits',
          body: `about ${Math.floor(balance / COST_PER_AUTO_POST)} auto posts left — top up in billing to keep it running.`,
        }).catch(() => {})
      }
    }
```
(imports: `maybeAutoTopup`, `hasRecentNotification`, `LOW_CREDIT_POSTS_LEFT`.)
- [ ] **Step 5:** bell `KIND_ICON` += `low_credits: 'account_balance_wallet'` (default indigo styling).
- [ ] **Step 6:** full gate; commit `Add low credit warning`.

---

### Task 5: Permalink capture (executor + stores + LinkedIn route)

**Files:**
- Modify: `lib/schedule/types.ts` (`ScheduledPost.permalinks`), `lib/schedule/store.ts` (Row/mapRow/`PublishOutcome.permalinks`/finishPublish), `lib/schedule/publish.ts` (AttemptResult.permalink, per-platform capture, decideOutcome 4th param), `lib/schedule/publish.test.ts`
- Modify: `app/api/linkedin/publish/route.ts` (manual publish returns the real update URL)

**Interfaces:**
- Produces: `ScheduledPost.permalinks: Partial<Record<SchedulePlatform, string>> | null`; `AttemptResult.permalink?: string`; `decideOutcome(retryCount, results, prior, priorPermalinks?: Partial<Record<SchedulePlatform, string>>)` (4th param optional — existing tests unchanged); `PublishOutcome.permalinks: Partial<Record<SchedulePlatform, string>>`.

- [ ] **Step 1 (RED):** extend `publish.test.ts`: an `ok` result carrying `permalink` lands in `outcome.permalinks`; prior permalinks are preserved on requeue; failed platforms get no permalink; `decideOutcome(0, [okWithLink], {}, { threads: 'kept' })` merges both.
- [ ] **Step 2 (GREEN):**
  - types.ts: add the field to `ScheduledPost`.
  - store.ts: `Row.permalinks`, mapRow, `PublishOutcome.permalinks`, finishPublish adds `permalinks = $7` (`JSON.stringify(outcome.permalinks)`). `recordInternalPublishError` deliberately untouched (crash requeue must not clobber links either).
  - publish.ts: `AttemptResult.permalink?: string`; `decideOutcome(retryCount, results, prior, priorPermalinks = {})` collects `links[r.platform] = r.permalink` for fresh successes and returns `permalinks: { ...priorPermalinks, ...links }` on every branch.
  - `publishToX`: import `getAccount as getXAccount` from `@/lib/x/store`; after posting, `const account = await getXAccount(post.userId)` → `permalink: account ? \`https://x.com/${account.username}/status/${id}\` : \`https://x.com/i/status/${id}\``.
  - `publishToThreads`: after publishing, `const permalink = await getPermalink(token, id).catch(() => null)` (import from `@/lib/threads/client`) → include when non-null. Fetched, never constructed.
  - `publishToLinkedIn`: `permalink: \`https://www.linkedin.com/feed/update/${id}/\`` (id IS the urn from the x-restli-id header).
  - `publishScheduledPost`: pass `post.permalinks ?? {}` as the 4th arg.
- [ ] **Step 3:** `app/api/linkedin/publish/route.ts`: replace the feed placeholder — `url: \`https://www.linkedin.com/feed/update/${id}/\``.
- [ ] **Step 4:** full gate; commit `Capture published post permalinks`.

---

### Task 6: Surface links — success notification + calendar modal + bell anchors; verify

**Files:**
- Modify: `lib/notifications/store.ts` (kind `post_published`; `addNotification` input += `link?`; `AppNotification.link`), `lib/schedule/publish.ts` (success notification), `components/app/NotificationsBell.tsx` (anchor rendering + icon `open_in_new`), `components/app/calendar/PostEditorModal.tsx` (live links)

- [ ] **Step 1:** notifications store: kind union += `'post_published'`; `link` in the insert (`$7`), `Row`, `mapRow`, `AppNotification`.
- [ ] **Step 2:** in `publishScheduledPost`, after `finishPublish`, alongside the existing failure branch add:
```ts
  if (outcome.status === 'published') {
    const links = Object.values(outcome.permalinks)
    await addNotification({
      userId: post.userId,
      kind: 'post_published',
      title: 'your post is live',
      body: links.length ? links.join('\n') : 'view it on your calendar.',
      link: links[0],
      refId: post.id,
    }).catch((e) => console.error('[schedule/publish] notify failed:', e))
  }
```
(Zero-touch users see output through this notification — spec B "Where it shows" #2.)
- [ ] **Step 3:** bell: `KIND_ICON` += `post_published: 'open_in_new'` (lime-ish default is fine — keep indigo); when `n.link` is set wrap the item content in `<a href={n.link} target="_blank" rel="noreferrer" …>` (hover underline on the title), else the current `<div>`.
- [ ] **Step 4:** `PostEditorModal` published block: for each platform in `post.permalinks ?? {}` render `<a href={url} target="_blank" rel="noreferrer" className="font-code-label text-code-label text-cyber-lime hover:underline">view live on {platformLabel(p)} →</a>`; fall back to the current plain "published to …" spans for platforms with an id but no permalink.
- [ ] **Step 5:** full gate (`npx tsc --noEmit && npm test && npm run build`).
- [ ] **Step 6 (live sim, no real publishing):** dev server + staff cookie: insert a `scheduled_posts` row `platforms:["x"]` due now for a user WITHOUT a connected X (same harness as before) → cron → row fails (no permalink, correct); then UPDATE a copy to `status='published', external_post_ids='{"x":"123"}', permalinks='{"x":"https://x.com/i/status/123"}'` → calendar modal shows "view live on X →"; insert a `post_published` notification with a link → bell renders an anchor. Clean everything up.
- [ ] **Step 7:** commit `Surface live post links`.

---

## Self-review

- **Spec A coverage:** A.1 onboarding reword → Task 2; A.2 default flip (DDL default + ALTER + store defaults, toggle kept in settings) → Tasks 1–2; A.3 topics=interests, round-robin across slots (single topic trivially constant) → Task 3; A.4 low-credit warning (threshold 5 posts, dedupe 72h) + auto-topup hook (documented seam) + hard-pause preserved untouched → Task 4; LinkedIn expiry nudge already shipped — no change; A.5 truthful no-login copy → Task 2.
- **Spec B coverage:** storage `permalinks` jsonb → Tasks 1+5; X constructed with handle fallback `/i/status/`, LinkedIn `feed/update/{urn}/` from `x-restli-id` urn (raw urn stays in external_post_ids), Threads FETCHED via existing `getPermalink` → Task 5; calendar "view live" per platform → Task 6; success notification with tappable link → Task 6; partial failure → links only for successes (decideOutcome only records permalinks off `ok` results); optional history view skipped (documented decision).
- **Guardrails:** no cron/generation/billing/storage rebuild — the credit gate gains 8 lines, the executor gains capture only; hard-pause path untouched; Threads never constructed.
- **Type consistency:** `permalinks` shape `Partial<Record<SchedulePlatform, string>>` used identically in types.ts/store.ts/publish.ts/PostEditorModal; `decideOutcome` 4th param optional keeps all 9 existing tests compiling; `link` optional end-to-end (store → API GET returns it automatically via mapRow → bell).
- **Placeholder scan:** clean; the auto-topup no-op is an explicit spec-sanctioned seam, not a TODO.
