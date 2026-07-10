import Link from 'next/link'
import { COST_PER_POST, COST_PER_REPLY, fmtCredits } from '@/lib/creditsConfig'
import { planDisplayName } from '@/lib/pricing'

// The subscription, impossible to miss (user feedback: "couldn't find where the
// plan lives"). Sits at the TOP of the profile page: plan badge, credits left,
// when they refresh, and the upgrade/manage actions - the Higgsfield-style
// always-visible plan block.
export function PlanCard({
  plan,
  trialing,
  endsAt,
  creditBalance,
  topupBalance,
  unlimited,
}: {
  plan: string
  trialing: boolean
  /** Trial end (card-free) or next credits refresh date, ISO. */
  endsAt: string | null
  creditBalance: number
  topupBalance: number
  unlimited: boolean
}) {
  const isPaid = plan === 'starter' || plan === 'pro' || plan === 'founder'
  const label = unlimited ? 'Founder' : trialing && !isPaid ? 'Free trial' : planDisplayName(plan)
  const total = creditBalance + topupBalance
  const when = endsAt
    ? new Date(endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-electric-indigo/40 bg-surface-container-low p-6 indigo-glow">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-electric-indigo/15 blur-[70px]" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <span
            className={`rounded-full px-3 py-1 font-code-label text-[11px] font-bold uppercase tracking-widest ${
              isPaid || unlimited ? 'bg-electric-indigo text-white' : 'bg-cyber-lime text-charcoal-black'
            }`}
          >
            {label}
          </span>
          <p className="mt-3 font-headline-lg text-headline-lg leading-none">
            {unlimited ? 'Unlimited' : fmtCredits(total)}
            {!unlimited && <span className="ml-2 font-body-sm text-body-sm text-on-surface-variant">credits left</span>}
          </p>
          {!unlimited && (
            <p className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant">
              ≈ {Math.floor(total / COST_PER_POST).toLocaleString()} posts or{' '}
              {Math.floor(total / COST_PER_REPLY).toLocaleString()} replies
            </p>
          )}
          {!unlimited && when && (
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              {trialing && !isPaid ? `trial ends ${when}` : `plan credits refresh ${when}`}
              {topupBalance > 0 && <> · {fmtCredits(topupBalance)} top-up credits never expire</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!unlimited && plan !== 'pro' && plan !== 'founder' && (
            <Link
              href="/pricing"
              className="rounded-full bg-electric-indigo px-5 py-2.5 font-code-label text-code-label font-bold text-white transition-colors hover:bg-primary-container"
            >
              Upgrade
            </Link>
          )}
          <Link
            href="/app/settings/billing"
            className="rounded-full border border-border-muted px-5 py-2.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:border-electric-indigo/60 hover:text-on-surface"
          >
            Billing &amp; usage
          </Link>
        </div>
      </div>
    </div>
  )
}
