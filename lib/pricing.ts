// Single source of truth for all pricing numbers/copy. Change here only.

export type BillingMode = 'monthly' | 'annual'

export type Plan = {
  id: string
  name: string
  tagline: string
  highlight?: boolean
  /** limited founding tier — distinct lime treatment, no annual discount */
  founder?: boolean
  badge?: string
  monthly: { perMo: number; sub: string }
  annual: { perMo: number; sub: string; save: string }
  features: string[]
  cta: string
}

export const OFFER = {
  text: 'Founding offer ends soon — $1/mo locked for life, first 10 founders',
  cta: 'Claim it',
  /** where the urgency CTA routes (existing waitlist flow) */
  href: '/early-access?plan=founders',
}

export const ANNUAL_BADGE = '3 days free'

export const PRICING_NOTE = 'Pricing is for launch and may change.'

export const PLANS: Plan[] = [
  {
    id: 'founders',
    name: 'Founders',
    tagline: 'first 10 builders only — your rate is locked for life',
    founder: true,
    badge: 'Only 10 spots',
    monthly: { perMo: 1, sub: 'first 10 founders · locked for life' },
    annual: { perMo: 1, sub: 'first 10 founders · locked for life', save: '' },
    features: [
      'Everything in Pro',
      '$1/mo locked for life — never goes up',
      'Direct line to the founder',
      'Shape the roadmap',
    ],
    cta: 'Claim my spot',
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'for solo builders posting in their own voice',
    monthly: { perMo: 5, sub: 'billed monthly' },
    annual: { perMo: 4.17, sub: 'billed annually · $50/year', save: 'save $10/year' },
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
    monthly: { perMo: 15, sub: 'billed monthly' },
    annual: { perMo: 12.5, sub: 'billed annually · $150/year', save: 'save $30/year' },
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
