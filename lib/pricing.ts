// Single source of truth for all pricing numbers/copy. Change here only.

export type BillingMode = 'monthly' | 'annual'

export type Plan = {
  id: string
  name: string
  tagline: string
  highlight?: boolean
  /** Free trial tier: rendered as "Free / 7 days" and ignores the billing toggle. */
  trial?: boolean
  badge?: string
  monthly: { perMo: number; sub: string }
  annual: { perMo: number; sub: string; save: string }
  features: string[]
  cta: string
  /** Where the card's CTA goes. Defaults to /signup when omitted. */
  href?: string
}

export const ANNUAL_BADGE = '7 days free'

export const PRICING_NOTE = 'Pricing is for launch and may change.'

// Everyone starts on a 7-day free trial capped at this many drafts.
export const TRIAL_DRAFTS = 5

// Prices shown in the UI. Checkout itself goes through Polar via
// /api/billing/checkout (see lib/billing). Pro is the default upsell.
export const PRO_PRICE = 30
export const STARTER_PRICE = 15

export const PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Free trial',
    tagline: 'try Outloud in your own voice',
    trial: true,
    badge: '7 days free',
    monthly: { perMo: 0, sub: '7 days free' },
    annual: { perMo: 0, sub: '7 days free', save: '' },
    features: [
      '7 days free, no card needed',
      `${TRIAL_DRAFTS} drafts to start`,
      'Posts in your voice across X, LinkedIn & Telegram',
      'Voice capture from your existing posts',
      'X Reply engine included',
      '1 connected account per platform',
    ],
    cta: 'Start free',
    href: '/signup',
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'for solo builders posting in their own voice',
    monthly: { perMo: 15, sub: 'billed monthly' },
    annual: { perMo: 10, sub: 'billed annually · $120/year', save: 'save 33%' },
    features: [
      'Posts in your voice across X, LinkedIn & Telegram',
      'Voice capture from your existing posts',
      'X Reply engine included',
      'Topic search to find what to reply to',
      '1 connected account per platform',
    ],
    cta: 'Get Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'for founders & creators going all-in on growth',
    highlight: true,
    badge: 'Most popular',
    monthly: { perMo: 30, sub: 'billed monthly' },
    annual: { perMo: 20, sub: 'billed annually · $240/year', save: 'save 33%' },
    features: [
      'Everything in Starter',
      'X Reply engine + trending discovery',
      'Style presets + adjustable hook intensity',
      'Multiple accounts / handle strategy',
      'Priority generation',
    ],
    cta: 'Upgrade to Pro',
  },
]
