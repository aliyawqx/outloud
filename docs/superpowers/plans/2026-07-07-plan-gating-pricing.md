# Plan Gating (Autopilot = Pro) + Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate autopilot to the Pro tier (trial counts as Pro), make manual posting unlimited on paid plans (decision-lever default), handle Pro→Starter downgrade cleanly, and update the pricing page copy — all on the existing Polar plan/profile machinery.

**Architecture:** One shared tier helper (`lib/billing/tier.ts`) reads `profiles.plan` + the existing card-free-trial fields (the same logic `app/app/layout.tsx` already uses for its `gated` flag — refactored to share). Three server-side enforcement points: `PUT /api/autopilot` (403 `needsPro` on enable), the generation cron (defensive re-check + lazy downgrade cleanup `dropAutopilotForNonPro`: disable + cancel pending + refund + notify), and the Polar webhook `subscription.revoked` (immediate cleanup). Manual post generation switches from credit-metering to plan-gating behind one flag (`MANUAL_POSTS_UNLIMITED = true`); the 402 response reuses `insufficientCredits: true` so the existing UpgradeModal client paths work unchanged. Autopilot stays credit-metered for everyone (existing `COST_PER_AUTO_POST`, hard-pause at zero, slots/day ≤ 8 ceiling).

**Tech Stack:** existing modules only; no schema changes, no new dependencies.

## Global Constraints

- Tier enforcement server-side in all three spots; client locks are UX only.
- Autopilot stays metered even on Pro ("unlimited" = the derived slots/day ceiling ≤ 8 + credit meter + zero-pause). `COST_PER_AUTO_POST` unchanged.
- Manual scheduling is NOT gated — both tiers schedule.
- Trial (card-free 3-day window, existing semantics: `trialing && !polarSubscriptionId && creditBalance > 0 && creditsResetAt > now`) counts as **Pro** for gating (spec §5).
- Downgrade (recommended option): cancel pending unpublished autopilot posts + refund via the EXISTING `refund` helper; manual posts/calendar untouched; in-app note with upgrade link.
- Decision lever (default taken): manual post generation is UNLIMITED on active plans/trial; credits keep metering images, stock photos, replies, topic search, autopilot. One flag `MANUAL_POSTS_UNLIMITED` in `lib/creditsConfig.ts` flips it back.
- Reuse Polar checkout/paywall components (`UpgradeModal`, `TrialGate`, `PlanCard`); staff (`isStaff`) remains all-access.
- Repo conventions: no zod, `getSession()` → 401, commit messages English ≤5 words, `npx tsc --noEmit && npm test && npm run build` before merge, product copy short/lowercase-friendly.
- Calendar "autopilot fills empty slots" affordance was never built (optional in the scheduler spec) — nothing to lock there; noted, not built now (YAGNI).

---

### Task 1: Shared tier helper + layout refactor

**Files:**
- Create: `lib/billing/tier.ts`
- Test: `lib/billing/tier.test.ts` (pure `isTrialActive`)
- Modify: `app/app/layout.tsx` (replace the inline `inCardFreeWindow` Boolean with the shared helper)

**Interfaces:**
- Produces:
  - `isTrialActive(p: { trialing?: boolean | null; polarSubscriptionId?: string | null; creditBalance?: number | null; creditsResetAt?: string | Date | null } | null): boolean` (pure)
  - `type TierInfo = { plan: string; trialActive: boolean; isPro: boolean; hasActivePlan: boolean }`
  - `getUserTier(userId: string, email?: string): Promise<TierInfo>` — `isPro` = staff | plan∈{pro,founder} | trialActive; `hasActivePlan` = staff | plan∈{starter,pro,founder} | trialActive.

- [ ] **Step 1 (RED):** `lib/billing/tier.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { isTrialActive } from './tier'

const base = {
  trialing: true,
  polarSubscriptionId: null,
  creditBalance: 5000,
  creditsResetAt: new Date(Date.now() + 86_400_000).toISOString(),
}

describe('isTrialActive', () => {
  it('true for a live card-free trial', () => {
    expect(isTrialActive(base)).toBe(true)
  })
  it('false once any leg dies', () => {
    expect(isTrialActive({ ...base, trialing: false })).toBe(false)
    expect(isTrialActive({ ...base, creditBalance: 0 })).toBe(false)
    expect(isTrialActive({ ...base, creditsResetAt: new Date(Date.now() - 1000).toISOString() })).toBe(false)
    expect(isTrialActive({ ...base, polarSubscriptionId: 'sub_x' })).toBe(false)
    expect(isTrialActive(null)).toBe(false)
  })
})
```

Run `npx vitest run lib/billing/tier.test.ts` → FAIL (module missing).

- [ ] **Step 2 (GREEN):** `lib/billing/tier.ts`

```ts
import { isStaff } from '@/lib/appLock'
import { getProfile } from '@/lib/profile/store'

// THE tier source of truth (spec §3): every gate — autopilot enable, the
// generation cron's defensive re-check, and manual-post gating — asks here.

const PRO_PLANS = new Set(['pro', 'founder'])
const PAID_PLANS = new Set(['starter', 'pro', 'founder'])

/** Card-free 3-day trial still running. Same semantics as the layout's trial
 *  window: it ends when credits hit 0 OR the window elapses OR a Polar sub
 *  takes over. Pure so both the layout and getUserTier share it. */
export function isTrialActive(
  p: {
    trialing?: boolean | null
    polarSubscriptionId?: string | null
    creditBalance?: number | null
    creditsResetAt?: string | Date | null
  } | null,
): boolean {
  return Boolean(
    p?.trialing &&
      !p.polarSubscriptionId &&
      (p.creditBalance ?? 0) > 0 &&
      p.creditsResetAt &&
      new Date(p.creditsResetAt).getTime() > Date.now(),
  )
}

export type TierInfo = {
  plan: string
  trialActive: boolean
  /** Autopilot access: Pro/founder plan, staff, or an active trial (spec §5). */
  isPro: boolean
  /** Manual generation access: any paid plan, staff, or an active trial. */
  hasActivePlan: boolean
}

export async function getUserTier(userId: string, email?: string): Promise<TierInfo> {
  const profile = await getProfile(userId)
  const plan = profile?.plan ?? 'free'
  const trialActive = isTrialActive(profile)
  const staff = email ? isStaff(email) : false
  return {
    plan,
    trialActive,
    isPro: staff || PRO_PLANS.has(plan) || trialActive,
    hasActivePlan: staff || PAID_PLANS.has(plan) || trialActive,
  }
}
```

Run the test → PASS.

- [ ] **Step 3:** `app/app/layout.tsx` — import `isTrialActive` from `@/lib/billing/tier`, replace the inline `const inCardFreeWindow = Boolean(...)` block with `const inCardFreeWindow = isTrialActive(profile)` (keep the explanatory comment, pointing at the helper).
- [ ] **Step 4:** `npx tsc --noEmit && npm test`; commit `Add shared tier helper`.

---

### Task 2: Autopilot gating — enable check, cron re-check, downgrade cleanup

**Files:**
- Create: `lib/autopilot/gating.ts`
- Modify: `app/api/autopilot/route.ts` (PUT enable → 403 `needsPro`)
- Modify: `app/api/cron/generate/route.ts` (defensive per-user tier check)
- Modify: `app/api/billing/webhook/route.ts` (`subscription.revoked` → cleanup)

**Interfaces:**
- Consumes: `getUserTier` (Task 1); `getAutopilotSettings`/`upsertAutopilotSettings` (autopilot store), `listUpcomingAutopilot`/`cancelScheduledPost` (schedule store), `refund` (credits), `addNotification` (notifications).
- Produces: `dropAutopilotForNonPro(userId: string): Promise<boolean>` — no-op returning false when autopilot wasn't enabled; else disables it, cancels pending unpublished autopilot posts (refunding charged ones via the existing helper), notifies with an upgrade link, returns true.

- [ ] **Step 1:** `lib/autopilot/gating.ts`

```ts
import { refund } from '@/lib/credits'
import { addNotification } from '@/lib/notifications/store'
import { cancelScheduledPost, listUpcomingAutopilot } from '@/lib/schedule/store'
import { getAutopilotSettings, upsertAutopilotSettings } from './store'

// Downgrade handling (spec §6, recommended option): the moment a user is no
// longer Pro, autopilot turns off and pending auto posts are cancelled (with
// charged-but-unpublished ones refunded via the existing helper). Manual posts,
// scheduled manual posts and the calendar are untouched. Called lazily by the
// generation cron's defensive re-check AND eagerly by the Polar webhook.
export async function dropAutopilotForNonPro(userId: string): Promise<boolean> {
  const settings = await getAutopilotSettings(userId)
  if (!settings.enabled) return false

  await upsertAutopilotSettings(userId, { enabled: false })

  const pending = await listUpcomingAutopilot(userId, 100)
  for (const p of pending) {
    const cancelled = await cancelScheduledPost(userId, p.id)
    if (cancelled && p.chargeLedgerId && p.creditsCharged > 0 && !p.publishedAt) {
      await refund(userId, p.chargeLedgerId).catch((e) => console.error('[autopilot/gating] refund failed:', e))
    }
  }

  await addNotification({
    userId,
    kind: 'autopilot_paused',
    title: 'autopilot is off — pro ended',
    body: 'your pro plan ended, so autopilot stopped and queued auto posts were cancelled. your manual posts and calendar are untouched. upgrade to turn it back on.',
    link: '/pricing',
  }).catch(() => {})
  return true
}
```

- [ ] **Step 2:** `app/api/autopilot/route.ts` — in the existing `if (patch.enabled)` essentials block, add FIRST (before the interests/times/platforms checks), with `getUserTier` imported from `@/lib/billing/tier`:

```ts
  if (patch.enabled) {
    // Autopilot is a Pro feature (trial counts as Pro — spec §5). Server-side:
    // the UI lock is UX, this is the enforcement.
    const tier = await getUserTier(session.userId, session.email)
    if (!tier.isPro) {
      return NextResponse.json(
        { error: 'Autopilot is a Pro feature. Upgrade to turn it on.', needsPro: true },
        { status: 403 },
      )
    }
    // ...existing merged-essentials validation stays below...
  }
```

- [ ] **Step 3:** `app/api/cron/generate/route.ts` — inside the candidates loop, before the essentials guard (imports: `getUserTier`, `dropAutopilotForNonPro`):

```ts
    // Defensive tier re-check (spec §3.2): a downgraded user may still carry a
    // stale enabled=true row — never auto-post for them; clean up lazily.
    const tier = await getUserTier(settings.userId, email)
    if (!tier.isPro) {
      await dropAutopilotForNonPro(settings.userId).catch((e) =>
        console.error('[cron/generate] downgrade cleanup failed:', e),
      )
      skipped++
      continue
    }
```

- [ ] **Step 4:** `app/api/billing/webhook/route.ts` — in the `subscription.revoked` branch after `zeroPlanCredits(userId)`:

```ts
        // Pro ended → autopilot off + pending auto posts cancelled (spec §6).
        await dropAutopilotForNonPro(userId).catch((e) => console.error('[billing/webhook] autopilot drop failed:', e))
```

(import `dropAutopilotForNonPro` from `@/lib/autopilot/gating`.)

- [ ] **Step 5:** `npx tsc --noEmit && npm test`; commit `Gate autopilot behind pro`.

---

### Task 3: Manual posts unlimited (plan-gated instead of credit-metered)

**Files:**
- Modify: `lib/creditsConfig.ts` (+`MANUAL_POSTS_UNLIMITED = true`)
- Modify: `app/api/voice/chat/route.ts` (tier gate instead of credit charge)
- Modify: `app/api/auth/signup/route.test.ts` — NOT touched (no signup changes); listed to remind: run the full suite.

**Interfaces:**
- Consumes: `getUserTier` (Task 1).
- Produces: manual post generation free of credit deductions when the flag is on; 402 `{ error, insufficientCredits: true }` for users with no active plan/trial (reusing the exact field the composer/reply clients already branch on to open `UpgradeModal` — zero client changes).

- [ ] **Step 1:** `lib/creditsConfig.ts` — after `COST_PER_POST`:

```ts
// Decision lever (plan-gating spec §1): manual post generation is UNLIMITED on
// active plans/trial — a human writes only so many. Credits keep metering
// images, stock photos, replies, topic search, and autopilot. Flip to false to
// return manual posts to the credit meter.
export const MANUAL_POSTS_UNLIMITED = true
```

- [ ] **Step 2:** `app/api/voice/chat/route.ts` — two edits (import `MANUAL_POSTS_UNLIMITED` from `@/lib/credits` re-exports or `@/lib/creditsConfig`, and `getUserTier` from `@/lib/billing/tier`):

(a) Replace the pre-check block:

```ts
  // Metered by credits (staff are unlimited). Cheap pre-check so we don't run any
  // LLM work for a user who can't afford a post; the real charge is atomic below.
  const staff = isStaff(session.email)
  if (!staff) {
    await resetIfDue(session.userId) // refill the free allowance if its cycle elapsed
    if (MANUAL_POSTS_UNLIMITED) {
      // Manual posts are plan-gated, not credit-metered (plan-gating spec §1):
      // any active plan or a live trial writes freely; an expired trial must
      // pick a plan. Reuses insufficientCredits so the existing UpgradeModal
      // client paths open the plans without any client change.
      const tier = await getUserTier(session.userId, session.email)
      if (!tier.hasActivePlan) {
        return NextResponse.json(
          { error: 'Your free trial has ended. Pick a plan to keep posting.', insufficientCredits: true, cost: 0, balance: 0 },
          { status: 402 },
        )
      }
    } else {
      const balance = await getBalance(session.userId)
      if (balance < COST_PER_POST) {
        return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: COST_PER_POST, balance }, { status: 402 })
      }
    }
  }
```

(b) Wrap the atomic charge block (the `if (!staff) { try { const charge = await deduct(...` section inside the stream) in the same flag:

```ts
        if (!staff && !MANUAL_POSTS_UNLIMITED) {
          // ...existing deduct / InsufficientCreditsError / FREE_DRAFT_FLOOR logic unchanged...
        }
```

(`chargeLedgerId` stays `undefined` when unlimited → the existing refund guards no-op; `freeDraft` stays false; `creditsLeft` in the done event still reports the real balance.)

- [ ] **Step 3:** Verify the reply/search/image routes still meter (no changes there — grep that they don't import `MANUAL_POSTS_UNLIMITED`).
- [ ] **Step 4:** `npx tsc --noEmit && npm test && npm run build`; commit `Make manual posts unlimited`.

---

### Task 4: UI — locked Pro card on the autopilot page

**Files:**
- Create: `components/app/autopilot/AutopilotProLock.tsx`
- Modify: `app/app/autopilot/page.tsx` (render lock instead of the panel for non-Pro)

**Interfaces:**
- Consumes: `getUserTier` (Task 1).
- Produces: visible-but-locked autopilot page (spec §7) with an "Upgrade to Pro" CTA to `/pricing`.

- [ ] **Step 1:** `components/app/autopilot/AutopilotProLock.tsx`

```tsx
import Link from 'next/link'

// Visible-but-locked (spec §7): Starter/expired users SEE what autopilot is —
// that sells the upgrade better than hiding the page.
export function AutopilotProLock() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-electric-indigo/40 bg-electric-indigo/5 p-6">
      <span className="flex items-center gap-2 rounded-full border border-electric-indigo/60 px-3 py-1 font-code-label text-code-label uppercase text-electric-indigo">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">lock</span>
        Pro feature
      </span>
      <p className="font-body-md text-body-md text-on-surface">
        pick a topic, set a time — outloud writes and publishes for you, even when you&apos;re not here. no login needed.
      </p>
      <ul className="flex flex-col gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
        <li>· auto-fills the empty slots on your calendar</li>
        <li>· fully hands-off posting across X, Threads and LinkedIn</li>
        <li>· live links to every published post, right in your notifications</li>
      </ul>
      <Link
        href="/pricing"
        className="rounded-full bg-electric-indigo px-6 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95"
      >
        Upgrade to Pro
      </Link>
    </div>
  )
}
```

- [ ] **Step 2:** `app/app/autopilot/page.tsx` — load the tier alongside the existing `Promise.all` (`getUserTier(session.userId, session.email)`), and render:

```tsx
      {!tier.isPro ? (
        <AutopilotProLock />
      ) : (
        <>
          {(needsReconnect || expiring) && <LinkedInReconnectBanner expiring={!needsReconnect && expiring} />}
          <AutopilotSettingsPanel ... />
        </>
      )}
```

(keep the header block above in both branches; onboarding step 4 needs no change — every new user is in an active trial = Pro).

- [ ] **Step 3:** `npx tsc --noEmit && npm test && npm run build`; commit `Add autopilot pro lock`.

---

### Task 5: Pricing copy (§8)

**Files:**
- Modify: `lib/pricing.ts` (PLANS features/taglines + trial line)
- Modify: the pricing section header component (grep for where `PLANS` renders its heading — `components/Pricing.tsx` / `app/pricing/page.tsx`; update the H1/H2 to the spec header)

**Interfaces:** copy only; `Plan` type unchanged.

- [ ] **Step 1:** In `lib/pricing.ts` update:
  - Header consumers (Step 2) get: **"Write it yourself, or let it run."**
  - Trial plan: tagline `'Try Outloud with autopilot switched on'`; features →

```ts
    features: [
      '3 days free, no card needed',
      'Autopilot switched on — watch it work',
      'Posts in your voice across X, LinkedIn & Threads',
      '10,000 credits for images & autopilot',
      'Voice capture from your existing posts',
    ],
```

  - Starter: tagline `'For builders who want to write and schedule on their own terms'`; features →

```ts
    features: [
      'Posts in your authentic voice, matched to how you actually write',
      'Publish to X, LinkedIn, and Threads',
      'Schedule ahead on one shared calendar',
      'Unlimited posts',
      'Image generation + stock photos (credits)',
    ],
```

  - Pro: tagline `'Everything in Starter, plus autopilot — so you never have to log in'`; features →

```ts
    features: [
      'Pick a topic, set a time — Outloud writes and publishes for you',
      'Fully hands-off posting across all platforms',
      'Auto-fills the empty slots on your calendar',
      'Live links to every published post',
      'Everything in Starter',
    ],
```

- [ ] **Step 2:** Find the pricing heading + subtitle (grep `"pricing"` headings in `components/Pricing.tsx`, `app/pricing/page.tsx`, landing pricing section) and set: heading **"Write it yourself, or let it run."**, sub/trial line **"Start free for 3 days — with autopilot switched on, so you can watch it work."** Keep existing layout/components; copy only.
- [ ] **Step 3:** `npx tsc --noEmit && npm test && npm run build`; visual check of `/pricing` via dev server (200 + strings present via curl grep); commit `Update pricing copy`.

---

### Task 6: Verification + deploy

- [ ] **Step 1:** Full gate: `npx tsc --noEmit && npm test && npm run build`.
- [ ] **Step 2:** Live checks (dev server + staff cookie + a NON-staff scenario via direct DB reads only):
  - `PUT /api/autopilot {enabled:true}` as staff → 200 (staff = Pro).
  - Simulate non-Pro: pick a test user with plan='free', expired trial (or temporarily flip a test row) → PUT enable → 403 `needsPro`; `GET /app/autopilot` shows the lock card. Restore anything touched.
  - Cron defensive path: give that non-Pro user `enabled=true` directly in DB + a future slot → `POST /api/cron/generate` → user skipped, `enabled` flipped false, pending cancelled, notification with `/pricing` link exists. Clean up.
  - Manual unlimited: as staff (or any active-plan user) generate a post → no `credit_ledger` 'post' deduction appears.
  - `/pricing` renders the new copy.
- [ ] **Step 3:** Merge to main, `vercel deploy --prod`.

---

## Self-review

- **Spec coverage:** §1/§2 plan structure → Tasks 3 (unlimited manual, lever flag) + 4/5 (visibility); §3 three server-side gates via ONE helper → Tasks 1–3 (PUT, cron, and scheduling endpoints deliberately untouched); §4 metering kept (no changes needed — COST_PER_AUTO_POST, zero-pause, low-credit warning, ≤8 slots/day ceiling all shipped earlier); §5 trial = Pro via `isTrialActive` inside `getUserTier`, onboarding untouched (new users are always in-trial); §6 downgrade → `dropAutopilotForNonPro` (cancel+refund recommended option) called from cron (lazy) + webhook revoke (eager), manual content untouched, notification with upgrade link; §7 visible-but-locked page → Task 4, calendar affordance N/A (never built — documented); §8 copy → Task 5; §9 guardrails → Global Constraints.
- **Type consistency:** `TierInfo`/`getUserTier`/`isTrialActive` defined once (Task 1), consumed in Tasks 2–4; `dropAutopilotForNonPro` defined in Task 2, consumed by cron + webhook; `MANUAL_POSTS_UNLIMITED` defined and consumed in Task 3 only.
- **Placeholder scan:** clean; Task 5 Step 2 names a concrete grep target and exact strings.
- **Risk note:** Task 3 changes monetization on a LIVE product — the flag makes rollback one-line; the 402 reuses the existing `insufficientCredits` client contract so no UI regressions.
