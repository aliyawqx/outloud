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

export const ANNUAL_BADGE = '3 days free'

export const PRICING_NOTE = 'Pricing is for launch and may change.'

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'for solo builders posting in their own voice',
    monthly: { perMo: 5, sub: 'billed monthly' },
    annual: { perMo: 4.17, sub: 'billed annually · $50/year', save: 'save $10/year' },
    features: [
      'Posts in your voice across X, LinkedIn & Telegram',
      'Voice capture from your existing posts',
      'Up to 20 posts / month',
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
    monthly: { perMo: 15, sub: 'billed monthly' },
    annual: { perMo: 12.5, sub: 'billed annually · $150/year', save: 'save $30/year' },
    features: [
      'Everything in Starter',
      'Unlimited posts',
      'X Reply engine: up to 30 replies / day + trending-post discovery',
      'Style presets + adjustable hook intensity',
      'Multiple accounts / handle strategy',
      'Priority generation',
    ],
    cta: 'Join the waitlist',
  },
]
