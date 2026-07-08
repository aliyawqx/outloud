'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { AddCredits } from '@/components/app/AddCredits'
import { startCheckout, openBillingPortal } from '@/lib/billing/client'
import { PLAN_ALLOWANCE, fmtCredits } from '@/lib/creditsConfig'
import { isPaidPlan } from '@/lib/billing/plans'
import { STARTER_PRICE, PRO_PRICE } from '@/lib/pricing'

type Feature = { key: string; label: string; cost: number; count: number; total: number }
type LedgerEntry = { id: string; createdAt: string; reason: string; amount: number; metadata: Record<string, unknown> }
type Usage = {
  balance: number
  topupBalance: number
  cycleTotal: number
  cycleUsed: number
  resetAt: string | null
  daily: { date: string; used: number }[]
  byFeature: Feature[]
  ledger: LedgerEntry[]
}

// Human label for a ledger row, from its reason + metadata. Onboarding / voice capture
// never appears here because it doesn't consume credits (it's infra, off the meter).
function ledgerLabel(e: LedgerEntry): string {
  const m = e.metadata ?? {}
  switch (e.reason) {
    case 'post':
      return m.floor ? 'Post draft · free (trial floor)' : 'Post draft'
    case 'reply':
      return 'Reply'
    case 'ai_image':
      return 'AI image'
    case 'photo_search':
      return 'Photo search'
    case 'search':
      return 'Topic search'
    case 'purchase':
      return 'Credit top-up'
    case 'refund':
      return 'Refund (failed action)'
    case 'reset':
      return m.trialExpired ? 'Trial ended' : 'Credits reset'
    case 'grant':
      if (m.cardFreeWindow || m.trial) return 'Trial credits granted'
      return 'Plan credits'
    default:
      return e.reason
  }
}

function ledgerTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const kEach = (cost: number) => `${fmtCredits(cost)} each`
function resetLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return ` · resets ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const PLAN_META: Record<string, { name: string; price: number; allowance: number }> = {
  free: { name: 'Free', price: 0, allowance: 0 },
  starter: { name: 'Starter', price: STARTER_PRICE, allowance: PLAN_ALLOWANCE.starter },
  pro: { name: 'Pro', price: PRO_PRICE, allowance: PLAN_ALLOWANCE.pro },
  founder: { name: 'Founder', price: 0, allowance: PLAN_ALLOWANCE.founder },
}

function UsageTab({ trialing, plan, unlimited }: { trialing: boolean; plan: string; unlimited: boolean }) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/credits/usage')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(setUsage)
      .catch(() => setError('Could not load usage right now.'))
  }, [])

  if (error) return <p className="font-body-sm text-body-sm text-error">{error}</p>
  if (!usage) return <div className="flex justify-center py-12"><Spinner size={20} className="text-electric-indigo" /></div>

  // Total = plan allowance + persistent top-up. Show what's been USED out of it; the
  // bar fills as credits are spent.
  const total = usage.cycleTotal + usage.topupBalance
  // Bar fills with what's LEFT, not what's used.
  const leftPct = total > 0 ? Math.min(100, Math.round((usage.balance / total) * 100)) : 0
  const planName = (PLAN_META[plan] ?? PLAN_META.free).name
  const maxDay = Math.max(1, ...usage.daily.map((d) => d.used))

  return (
    <div className="flex flex-col gap-6">
      {/* Balance header - lead with what's LEFT to spend, not what's used */}
      <div data-tour="credit-balance" className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <div className="font-headline-sm text-headline-sm text-on-surface">
          {unlimited ? 'Unlimited' : `${fmtCredits(usage.balance)} credits left`}
          <span className="ml-2 font-code-label text-code-label text-on-surface-variant">{resetLabel(usage.resetAt)}</span>
        </div>
        {!unlimited && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-electric-indigo" style={{ width: `${leftPct}%` }} />
          </div>
        )}
        <p className="mt-3 font-code-label text-code-label text-on-surface-variant">
          {planName} plan
          {usage.topupBalance > 0 && (
            <> · <span className="text-cyber-lime">{fmtCredits(usage.topupBalance)} top-up · never expires</span></>
          )}
        </p>
      </div>

      {/* Daily graph */}
      <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <h2 className="mb-4 font-code-label text-code-label uppercase text-on-surface-variant">this cycle</h2>
        <div className="flex items-end justify-between gap-1" style={{ height: 120 }}>
          {usage.daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-2" title={`${dayLabel(d.date)}: ${fmtCredits(d.used)} credits`}>
              <div
                className="w-full rounded-t bg-electric-indigo/80"
                style={{ height: `${Math.round((d.used / maxDay) * 100)}%`, minHeight: d.used > 0 ? 4 : 2, opacity: d.used > 0 ? 1 : 0.25 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-code-label text-[10px] text-on-surface-variant/60">
          <span>{usage.daily[0] ? dayLabel(usage.daily[0].date) : ''}</span>
          <span>{usage.daily.length ? dayLabel(usage.daily[usage.daily.length - 1].date) : ''}</span>
        </div>
      </div>

      {/* Spend breakdown */}
      <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <h2 className="mb-3 font-code-label text-code-label uppercase text-on-surface-variant">spend this cycle</h2>
        <div className="flex flex-col divide-y divide-border-muted">
          {usage.byFeature.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-2.5 font-body-sm text-body-sm">
              <span className="text-on-surface">{f.label}</span>
              <span className="flex items-center gap-3 text-on-surface-variant">
                <span className="hidden sm:inline">{kEach(f.cost)}</span>
                <span className="w-10 text-right tabular-nums">{f.count}</span>
                <span className="w-16 text-right tabular-nums text-on-surface">{fmtCredits(f.total)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-entry ledger: exactly where credits went, newest first. Onboarding / voice
          capture is intentionally absent - it doesn't consume credits. */}
      <div data-tour="usage-history" className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <h2 className="mb-1 font-code-label text-code-label uppercase text-on-surface-variant">activity</h2>
        <p className="mb-3 font-code-label text-code-label text-on-surface-variant/60">
          Credits are only used for drafting. Onboarding &amp; voice capture are free.
        </p>
        {usage.ledger.length === 0 ? (
          <p className="py-4 text-center font-body-sm text-body-sm text-on-surface-variant/60">No activity yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border-muted">
            {usage.ledger.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 font-body-sm text-body-sm">
                <span className="min-w-0">
                  <span className="block truncate text-on-surface">{ledgerLabel(e)}</span>
                  <span className="font-code-label text-code-label text-on-surface-variant/60">{ledgerTime(e.createdAt)}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${e.amount > 0 ? 'text-cyber-lime' : e.amount < 0 ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                  {e.amount > 0 ? '+' : ''}{fmtCredits(e.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buy more credits - only on an active paid plan (not free, not in trial) */}
      <div data-tour="plans-topups">
        <AddCredits
          eligible={isPaidPlan(plan) && !trialing}
          reason={
            trialing
              ? 'Top-ups unlock once your plan starts, after your free trial.'
              : 'Top-ups are available on a paid plan. Upgrade to add credits.'
          }
        />
      </div>
    </div>
  )
}

function BillingTab({ plan, trialing, hasBilling }: { plan: string; trialing: boolean; hasBilling: boolean }) {
  const meta = PLAN_META[plan] ?? PLAN_META.free
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  // A card-free trial window (trialing, no Polar subscription yet) → offer to start a
  // real subscription now, skipping the rest of the free trial (billed today).
  const canStartNow = trialing && !hasBilling

  async function upgrade(target: 'starter' | 'pro', skipTrial = false) {
    setError('')
    setBusy(skipTrial ? `now-${target}` : target)
    try {
      await startCheckout(target, 'monthly', { skipTrial })
    } catch (e) {
      setError((e as Error).message || "Couldn't open checkout.")
      setBusy(null)
    }
  }

  async function manage() {
    setError('')
    setBusy('portal')
    try {
      await openBillingPortal()
    } catch (e) {
      setError((e as Error).message || "Couldn't open the billing portal.")
      setBusy(null)
    }
  }

  // Plans the user can move up to.
  const upgrades = (['starter', 'pro'] as const).filter((p) => PLAN_META[p].allowance > meta.allowance)

  return (
    <div className="flex flex-col gap-6">
      {/* Start a subscription now - skip the rest of a card-free trial window. */}
      {canStartNow && (
        <div className="rounded-2xl border border-cyber-lime/30 bg-cyber-lime/5 p-5">
          <span className="font-code-label text-code-label uppercase text-cyber-lime">Free trial active</span>
          <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
            Don’t want to wait? Start a subscription now to skip the rest of your free trial - you’ll be billed
            today and your full plan credits unlock right away.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(['starter', 'pro'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => upgrade(p, true)}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
              >
                {busy === `now-${p}` ? <Spinner size={14} /> : null}
                Start {PLAN_META[p].name} · ${PLAN_META[p].price}/mo
              </button>
            ))}
          </div>
          {error && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">Current plan</span>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface">{meta.name}</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {meta.price > 0 ? `$${meta.price}/mo` : 'no card'} · {fmtCredits(meta.allowance)} credits/mo
          </span>
        </div>
        {/* Hide the plain upgrade buttons while the "start now" box is shown - they'd be
            the same two plans, just without the skip-trial framing. */}
        {upgrades.length > 0 && !canStartNow && (
          <div className="mt-4 flex flex-wrap gap-2">
            {upgrades.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => upgrade(p)}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-full bg-electric-indigo px-5 py-2 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
              >
                {busy === p ? <Spinner size={14} /> : null}
                Upgrade to {PLAN_META[p].name}
              </button>
            ))}
          </div>
        )}
        {error && !canStartNow && <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
      </div>

      {/* Payment method, invoices, change/cancel - all via the Polar customer portal. */}
      <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">Payment & invoices</span>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          Manage your payment method, download invoices, and change or cancel your plan in the secure Polar portal.
        </p>
        {hasBilling ? (
          <button
            type="button"
            onClick={manage}
            disabled={busy !== null}
            className="mt-3 inline-flex items-center gap-2 self-start rounded-full border border-border-muted px-5 py-2 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo disabled:opacity-60"
          >
            {busy === 'portal' ? <Spinner size={14} /> : null}
            Manage billing in Polar
          </button>
        ) : (
          <p className="mt-2 font-code-label text-code-label text-on-surface-variant/60">Starts once you begin a plan.</p>
        )}
      </div>
    </div>
  )
}

export function BillingUsage({ plan, trialing, hasBilling, unlimited = false }: { plan: string; trialing: boolean; hasBilling: boolean; unlimited?: boolean }) {
  const [tab, setTab] = useState<'usage' | 'billing'>('usage')
  const pill = (active: boolean) =>
    `rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors ${
      active ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'
    }`

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 font-headline-xl text-headline-xl">Billing &amp; usage</h1>
      <div className="mb-6 inline-flex items-center gap-1 rounded-full border border-border-muted bg-surface-container-low p-1">
        <button type="button" className={pill(tab === 'usage')} onClick={() => setTab('usage')}>Usage</button>
        <button type="button" className={pill(tab === 'billing')} onClick={() => setTab('billing')}>Billing</button>
      </div>
      {tab === 'usage' ? <UsageTab trialing={trialing} plan={plan} unlimited={unlimited} /> : <BillingTab plan={plan} trialing={trialing} hasBilling={hasBilling} />}
    </div>
  )
}
