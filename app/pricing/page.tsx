import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { Pricing } from '@/components/Pricing'
import { PlanCompare } from '@/components/PlanCompare'
import { PlanFinder } from '@/components/PlanFinder'
import { ScrollReveal } from '@/components/ScrollReveal'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { TrialBanner } from '@/components/TrialBanner'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'

export const metadata = { title: 'Outloud | Pricing' }

/** The signed-in visitor's plan as a pricing-card id ('trial'|'starter'|'pro'), or null. */
async function currentPlanId(): Promise<string | null> {
  const session = await getSession().catch(() => null)
  if (!session) return null
  const profile = await getProfile(session.userId).catch(() => null)
  if (!profile) return null
  if (profile.plan === 'starter' || profile.plan === 'pro') return profile.plan
  if (profile.trialing) return 'trial'
  return null
}

export default async function PricingPage() {
  const currentPlan = await currentPlanId()
  return (
    <>
      <TrialBanner sticky />

      <header className="border-b border-border-muted">
        <div className="mx-auto flex h-20 w-full max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="flex items-center gap-6">
            <Link className="font-body-md text-body-md text-on-surface-variant transition-colors hover:text-primary" href="/">
              Home
            </Link>
            <Link
              className="rounded-full bg-electric-indigo px-6 py-2 font-bold text-white transition-transform active:scale-95"
              href="/signup"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="pb-24 pt-8">
        <Pricing currentPlan={currentPlan} />
        <PlanFinder />
        <PlanCompare />
      </main>

      <SiteFooter />
      <ScrollReveal />
    </>
  )
}
