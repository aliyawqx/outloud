# Billing & Plans Canonical Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the codebase with the canonical Billing & Plans spec: reply cost 5k→3k, manual posts back on the credit meter, full plan-lifecycle fields (`plan_status`, `billing_interval`, periods, `credits_allotment`), all eleven motions (M1–M11) including monthly refill for annual subs, upgrade credit delta, downgrade autopilot drop, credit-exhaustion auto-resume + email, topic-search gating off trial, and the final §8 pricing copy.

**Architecture:** Extend `profiles` with the §7 fields (idempotent DDL + one backfill script). The Polar webhook becomes the writer of `plan_status`/`billing_interval`/period bounds and implements M4's upgrade delta and M5/M6's autopilot drop; `resetIfDue` becomes the universal M7 refill (paid plans refill monthly by `credits_reset_at` — annual included — independent of webhooks). `lib/billing/tier.ts` gains `canUseAutopilot` (plan_status-aware) and all three §6 gates switch to it. M9/M10 get a shared `pauseForCredits` (in-app + email) and auto-resume on top-up/refill.

**Tech Stack:** existing modules; no new dependencies (email via existing Resend).

## Global Constraints (spec = law; deviations listed below)

- `CREDIT_COSTS`: post 1_000, reply **3_000**; exported once from `lib/creditsConfig.ts`; footer line derives from constants (never hardcode).
- Manual posts are METERED again: `MANUAL_POSTS_UNLIMITED = false` (yesterday's lever flipped back per §4 "run before every generate/publish"); `FREE_DRAFT_FLOOR = 0` (M2 locks ALL generation after expiry; the 10k trial covers first experience).
- Two buckets, plan-first consumption (already true); ledger rows record the plan/top-up split in `metadata.bucket`.
- Autopilot gating in THREE places via `canUseAutopilot(sub)` = `planIsPro && plan_status === 'active' && autopilot_enabled` (trial does NOT get autopilot per §3 matrix — this supersedes the previous trial-counts-as-Pro rule).
- M7 refill is monthly for annual subscribers too, independent of M8 webhooks.
- Never let autopilot fail silently: pause + in-app + email; auto-resume on refill/top-up.
- **User-resolved conflict:** trial stays CARD-FREE (M1's card requirement deferred; §8 "no card needed" stays true).
- **Documented deviations (storage names keep back-compat, semantics per spec):** DB `plan` values stay `'free'|'starter'|'pro'|'founder'` — spec's `'trial'` == `plan='free' && plan_status='trialing'`, founder = staff comp (always active Pro); `plan_credits`/`topup_credits` remain columns `credit_balance`/`topup_balance`; `autopilot_enabled` remains `autopilot_settings.enabled`; `trial_ends_at` mirrors the existing `credits_reset_at`-as-trial-window for free accounts.
- Repo conventions unchanged (idempotent DDL both files + `scripts/sync-schema.ts`, no zod, commits ≤5 English words, full gate before merge).

---

### Task 1: Credit costs + meter flags

**Files:** `lib/creditsConfig.ts`, `components/Pricing.tsx` (footer line check), `lib/credits.ts` (re-export check)

- [ ] `COST_PER_REPLY` 5_000 → **3_000** (comment: canonical billing spec §2).
- [ ] Add the spec-named alias next to the constants:
```ts
/** Canonical cost table (billing spec §2). The individual constants remain the
 *  implementation; this object is the spec-facing name. */
export const CREDIT_COSTS = { post: COST_PER_POST, reply: COST_PER_REPLY } as const
```
- [ ] `MANUAL_POSTS_UNLIMITED` true → **false** (comment: billing spec §4 re-meters manual generation; the plan-gate branch in voice/chat stays for future use).
- [ ] `FREE_DRAFT_FLOOR` 3 → **0** (comment: billing spec M2 locks all generation on expiry; the 10k trial is the guaranteed first experience).
- [ ] Verify the pricing footer (`components/Pricing.tsx` line with `fmtCredits(COST_PER_REPLY)`) now renders "Reply ≈ 3k cr" automatically (no edit needed — confirm only).
- [ ] Gate + commit `Set canonical credit costs`.

### Task 2: §7 data model — columns, backfill, Profile mapping

**Files:** `lib/db.ts` + `db/schema.sql` (DDL), `lib/profile/store.ts` (Profile type + mapping + `setPlanStatus`/`setPeriod` helpers), `scripts/backfill-billing.ts` (one-off), run `scripts/sync-schema.ts`

- [ ] DDL (both files, idempotent), appended to the profiles ALTER block:
```sql
-- Canonical billing fields (billing spec §7). plan_status:
-- 'trialing'|'active'|'past_due'|'canceled'|'expired'. billing_interval:
-- 'monthly'|'annual'|NULL. credits_allotment = the plan's monthly grant.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_interval TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_allotment INTEGER;
```
- [ ] `scripts/backfill-billing.ts` (same .env loader as sync-schema; idempotent UPDATEs):
  - paid plans (`starter`,`pro`,`founder`) → `plan_status='active'`, `credits_allotment=PLAN_ALLOWANCE[plan]`;
  - `free` with live trial (trialing && credit_balance>0 && credits_reset_at>now) → `'trialing'`, `trial_ends_at=credits_reset_at`, allotment 10000;
  - remaining `free` → `'expired'`, allotment 10000.
- [ ] `lib/profile/store.ts`: extend `Profile` type + row mapping with `planStatus`, `billingInterval`, `currentPeriodStart/End`, `trialEndsAt`, `creditsAllotment`; add `setPlanStatus(userId, status)` and `setBillingPeriod(userId, { interval, start, end })` helpers (parameterized UPDATEs).
- [ ] Run `npx tsx scripts/sync-schema.ts` then `npx tsx scripts/backfill-billing.ts`; verify a paid row and a free row via information_schema/tsx probe.
- [ ] Gate + commit `Add canonical billing fields`.

### Task 3: Webhook motions M3/M4/M5/M6/M8/M11

**Files:** `app/api/billing/webhook/route.ts`, `lib/billing/plans.ts` (annual detection helper), `lib/credits.ts` (`grantUpgradeDelta`)

- [ ] `lib/billing/plans.ts`: add `intervalForProductId(productId): 'monthly' | 'annual' | null` using the existing `POLAR_*_ANNUAL_PRODUCT_ID` envs (annual ids → 'annual', monthly ids → 'monthly').
- [ ] `lib/credits.ts`: add `grantUpgradeDelta(userId, delta)` — transactional `UPDATE profiles SET credit_balance = credit_balance + $2` + ledger row `reason='grant'`, `metadata:{kind:'upgrade_delta'}` (M4: upgrade adds the delta, it does NOT reset).
- [ ] Webhook `subscription.created|active|updated|uncanceled` handler additions:
  - always: `setPlanStatus(userId, status === 'trialing' ? 'trialing' : 'active')`; `setBillingPeriod(userId, { interval: intervalForProductId(productId), start: current_period_start, end: current_period_end })` (fields from the Polar payload; null-safe); `credits_allotment` ← `PLAN_ALLOWANCE[plan]`.
  - **M4:** if previous `profile.plan === 'starter'` and new plan `'pro'` and same billing period (mid-cycle) → `grantUpgradeDelta(userId, PLAN_ALLOWANCE.pro - PLAN_ALLOWANCE.starter)` INSTEAD of `grantPlan` (which resets); keep `credits_reset_at` unchanged.
  - **M5:** if previous plan `'pro'` and new plan `'starter'` → after `setPlan`+`grantPlan`, `dropAutopilotForNonPro(userId)`.
- [ ] `subscription.canceled` (Polar sends on cancel-at-period-end): `setPlanStatus(userId, 'canceled')` — access continues until period end (M6); do NOT drop autopilot yet.
- [ ] `subscription.revoked` (existing): add `setPlanStatus(userId, 'expired')` alongside the existing `setPlan('free')`+`zeroPlanCredits`+`dropAutopilotForNonPro`.
- [ ] `order.paid` renewal (M8): also refresh `current_period_end` when the payload carries it; credits stay M7's job.
- [ ] Gate + commit `Wire billing motions webhook`.

### Task 4: M7 universal monthly refill + M2/M6 lazy expiry

**Files:** `lib/credits.ts` (`resetIfDue`)

- [ ] Extend `resetIfDue(userId)`:
  - existing free/trial expiry behavior stays, PLUS it now sets `plan_status='expired'` when it zeroes an expired trial (M2) and mirrors `trial_ends_at`;
  - paid plans (`starter`/`pro`/`founder`) with `credits_reset_at <= now`: `credit_balance = credits_allotment ?? PLAN_ALLOWANCE[plan]` (no rollover; top-ups untouched), advance `credits_reset_at` by +1 month REPEATEDLY until it's in the future (covers annual users away >1 month), ledger `reason='reset'`; **M6 boundary:** if `plan_status='canceled'` and `current_period_end <= now` → instead transition to expired: `setPlan free`, `zeroPlanCredits`, `plan_status='expired'`, `dropAutopilotForNonPro` — the lazy twin of the revoked webhook so a missed webhook never leaves a canceled sub active.
  - keep it transactional/row-locked like the existing implementation.
- [ ] Gate + commit `Universal monthly credit refill`.

### Task 5: M9/M10 — pause helper, email, auto-resume

**Files:** `lib/autopilot/pause.ts` (new), `lib/autopilot/generate.ts` (use helper in both pause paths + resume pre-step in cron), `app/api/cron/generate/route.ts` (resume sweep), `lib/credits.ts` (`addCredits` → auto-resume), `lib/notify.ts` (+`sendAutopilotPausedEmail`)

- [ ] `lib/notify.ts`: add `sendAutopilotPausedEmail(to: string)` — Resend, best-effort (no-throw), from the existing sender, short lowercase body ("autopilot paused — you're out of credits; top up or wait for your monthly refill and it resumes on its own"), subject `autopilot paused — out of credits`.
- [ ] `lib/autopilot/pause.ts`:
```ts
export async function pauseForCredits(userId: string, email?: string): Promise<void> {
  await pauseAutopilot(userId, 'insufficient_credits')
  await addNotification({ userId, kind: 'autopilot_paused', title: 'autopilot paused — not enough credits', body: 'top up in billing or wait for your monthly refill — it resumes on its own.', link: '/app/settings/billing' }).catch(() => {})
  if (email) await sendAutopilotPausedEmail(email) // best-effort inside
}
export async function resumeIfCreditPaused(userId: string): Promise<boolean> {
  // resume ONLY the insufficient_credits pause (never a user-initiated one)
}
```
  (`resumeIfCreditPaused`: read settings; if `pausedAt && pauseReason === 'insufficient_credits'` → `resumeAutopilot(userId)`, return true.)
- [ ] `lib/autopilot/generate.ts`: replace BOTH duplicated pause+notify blocks with `pauseForCredits(user.userId, user.email)` (kills the reviewer-flagged duplication).
- [ ] `app/api/cron/generate/route.ts`: add a resume sweep before the candidate loop — query users with `paused_at IS NOT NULL AND pause_reason='insufficient_credits' AND enabled`, for each: `resetIfDue` then if `getBalance >= COST_PER_AUTO_POST` → `resumeIfCreditPaused` (M7/M9 auto-resume; they'll be picked up next run since candidates exclude paused). Cap the sweep at 20/run.
- [ ] `lib/credits.ts` `addCredits` (M10): after a successful top-up insert → `resumeIfCreditPaused(userId)` best-effort (import from `@/lib/autopilot/pause`; lazy `await import` if needed to avoid cycles).
- [ ] Gate + commit `Auto resume paused autopilot`.

### Task 6: canUseAutopilot + three gates + topic-search gating

**Files:** `lib/billing/tier.ts` (+`canUseAutopilot`, plan_status-aware TierInfo), `lib/billing/tier.test.ts`, `app/api/autopilot/route.ts`, `app/api/cron/generate/route.ts`, `app/app/autopilot/page.tsx`, `components/app/VoiceOnboarding.tsx` (step-4 becomes Pro-aware), `app/api/reply/search/route.ts` (topic search off trial)

- [ ] `tier.ts`: `TierInfo` gains `planStatus: string` and `canUseAutopilot: boolean` = `staff || (plan∈{pro,founder} && planStatus === 'active')` (trial NO LONGER grants autopilot — spec §3 supersedes; `trialActive` still feeds `hasActivePlan` for manual flows). Tests: pro+active → true; pro+canceled → true? — NO: spec M6 keeps access until period end, and `plan_status='canceled'` means still inside the paid period (expired comes later) → **canceled counts as usable**: `planStatus === 'active' || planStatus === 'canceled'`. Add test cases for active/canceled/expired/trialing.
- [ ] PUT `/api/autopilot`: gate on `tier.canUseAutopilot` (message: 'Autopilot is a Pro feature. Upgrade to turn it on.', `needsPro`).
- [ ] Cron defensive check: switch `if (!tier.isPro)` → `if (!tier.canUseAutopilot)`.
- [ ] `/app/autopilot` page: lock condition → `!tier.canUseAutopilot`.
- [ ] Onboarding step 4: new users are trialing (NOT Pro now) — the step still collects topic/time (so settings are saved for later) but sends `enabled: false` and shows a small line "autopilot turns on with Pro — your setup is saved"; button label `Save for later` when not Pro... **Simpler per spec §7 UI (visible-but-locked):** keep the step, save settings with `enabled: false`, add the line `autopilot is a pro feature — your topics are saved and it switches on when you upgrade.` (Trial users still see the magic on the pricing/upsell; the trial-taste decision from the previous spec is superseded by §3's explicit matrix.)
- [ ] `app/api/reply/search/route.ts` (topic search, §3: Trial —): after auth, `const tier = await getUserTier(...); if (!tier.plan || tier.plan === 'free') return 403 { error: 'Topic search is available on paid plans.', needsUpgrade: true }` (staff bypass via tier).
- [ ] Gate + commit `Enforce canonical autopilot gating`.

### Task 7: §8 pricing copy

**Files:** `lib/pricing.ts`, `components/Pricing.tsx`

- [ ] PLANS per §8 verbatim: trial (name/tagline/features incl. 'no card needed', '10,000 credits to start', 'X Reply engine included', '1 connected account per platform'); starter tagline 'For solo builders posting in their own voice' + §8 features + credit subline; pro tagline **'Set it and it runs.'** + §8 features with the autopilot hero line FIRST + 'Everything in Starter' + credit subline; keep `badge: 'Most popular'`, annual prices unchanged ($120/$240, save 33%).
- [ ] Add `subline?: string` to the `Plan` type: starter `'200k credits / mo · ≈ 200 posts or 66 replies'`, pro `'600k credits / mo · ≈ 600 posts or 200 replies'`; render it in `PlanCard` under the price (small `font-code-label text-on-surface-variant`). (The card already shows `fmtCredits(credits) credits / mo` — replace that line with the subline when present.)
- [ ] Section header: keep `Write it yourself, or let it run.`; footer credit line already derives from constants (shows 3k after Task 1) + `PRICING_NOTE` unchanged.
- [ ] Gate + commit `Apply canonical pricing copy`.

### Task 8: Deduct bucket split (ledger auditability)

**Files:** `lib/credits.ts` (`deduct`)

- [ ] In `deduct`, read the pre-charge `credit_balance` inside the transaction (the UPDATE already computes the split implicitly): record `metadata.bucket = { plan: <spent from plan>, topup: <spent from topup> }` on the ledger row (plan spend = `min(cost, prior plan balance)`; requires selecting prior balance FOR UPDATE first or RETURNING both old/new — use `UPDATE ... RETURNING credit_balance, topup_balance` plus the prior values via a CTE `UPDATE ... FROM (SELECT ... FOR UPDATE)` or a preceding `SELECT ... FOR UPDATE` in the same txn).
- [ ] Gate + commit `Record ledger bucket split`.

### Task 9: Verification + deploy

- [ ] Full gate; live sims on dev server (temp users, same harness as before):
  - trialing user: manual post metered (ledger 'post' −1000), reply costs 3000, autopilot PUT → 403, topic search → 403, `/app/autopilot` locked;
  - starter+active: autopilot PUT → 403; topic search OK;
  - pro+active: autopilot PUT → 200;
  - pro+canceled (simulated): autopilot keeps working; flip `current_period_end` past + run resetIfDue → expired + autopilot dropped;
  - annual refill: paid user with `credits_reset_at` in the past + interval annual → resetIfDue refills to allotment and advances +1 month;
  - M4 sim: starter user, webhook-like upgrade call path → balance += 400k (via grantUpgradeDelta unit-style tsx);
  - pause→top-up auto-resume: paused-insufficient user + `addCredits` → resumed.
  - Clean everything up.
- [ ] Merge to main, `vercel deploy --prod`.

---

## Self-review

- **Spec coverage:** §1 prices already match (annual envs exist; annual≠12×credits handled by M7) → Tasks 3/4; §2 → Task 1 (reply 3k, CREDIT_COSTS, footer derives); §3 matrix → Task 6 (autopilot Pro-only incl. trial, topic search off trial; trending/presets/multi-account/priority are marketing lines without shipped features — nothing to gate, documented); §4 → already two-bucket plan-first + Task 1 re-metering + Task 8 bucket ledger; §5 M1 (card deferred per user decision, rest of M1 already true), M2 → Task 4 lazy expiry + existing TrialGate wall, M3 → webhook already + Task 3 fields, M4 delta → Task 3, M5 → Task 3, M6 → Tasks 3+4, M7 → Task 4 (annual monthly refill), M8 → Task 3 (refill decoupled), M9 → Task 5 (+email, never silent), M10 → Task 5 (auto-resume), M11 → Task 3 (interval update, allotment unchanged); §6 three places + helper → Task 6; §7 fields → Task 2 (named deviations documented in Global Constraints); §8 → Task 7 verbatim; §9 guardrails honored (600k untouched; autopilot text-only unchanged — `aiImages` toggle exists but defaults false and §9 only demands flagging before shipping image-autopilot as default: the toggle is user-opt-in with its own credit charge — noted here per the guardrail).
- **Supersessions made explicit:** trial-counts-as-Pro (previous spec §5) → REVOKED by §3 matrix (trial has no autopilot); MANUAL_POSTS_UNLIMITED lever → back to metered per §4; both single-line reversible.
- **Type consistency:** `TierInfo.canUseAutopilot` (Task 6) consumed by PUT/cron/page; `pauseForCredits`/`resumeIfCreditPaused` (Task 5) consumed by generate/cron/addCredits; `intervalForProductId`/`grantUpgradeDelta`/`setPlanStatus`/`setBillingPeriod` defined before use.
- **Placeholder scan:** clean.
