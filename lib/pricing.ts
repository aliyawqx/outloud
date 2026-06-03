// Single source of truth for all pricing numbers/copy. Change here only.

export type BillingMode = 'monthly' | 'annual'

export type Plan = {
  id: string
  name: string
  tagline: string
  highlight?: boolean
  badge?: string
  monthly: { perMo: number; sub: string }
  annual: { perMo: number; sub: string; save: string }
  features: string[]
  cta: string
}

export const OFFER = {
  text: 'Founding offer ends soon — 50% off for the first 10 founders',
  cta: 'Claim it',
  /** where the urgency CTA routes (existing waitlist flow) */
  href: '/early-access?plan=pro',
}

export const ANNUAL_BADGE = '2 months free'

export const PRICING_NOTE =
  'Pricing is for launch and may change. No card needed, this is a pre-launch waitlist.'

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'for solo builders posting in their own voice',
    monthly: { perMo: 19, sub: 'billed monthly' },
    annual: { perMo: 15, sub: 'billed annually · $180/year', save: 'save $48/year' },
    features: [
      'Posts in your voice across X, LinkedIn & Telegram',
      'Voice capture from your existing posts',
      'Up to 30 posts / month',
      'X Reply engine: up to 10 replies / day',
      '1 connected account per platform',
    ],
    cta: 'Join the waitlist',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'for founders & creators going all-in on growth',
    highlight: true,
    badge: 'Most popular',
    monthly: { perMo: 49, sub: 'billed monthly' },
    annual: { perMo: 39, sub: 'billed annually · $468/year', save: 'save $120/year' },
    features: [
      'Everything in Starter',
      'Unlimited posts',
      'X Reply engine: up to 40 replies / day + trending-post discovery',
      'Style presets + adjustable hook intensity',
      'Multiple accounts / handle strategy',
      'Priority generation',
    ],
    cta: 'Join the waitlist',
  },
]
