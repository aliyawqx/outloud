// Single source of truth for all pricing numbers/copy. Change here only.

export type BillingMode = 'monthly' | 'annual'

export type Plan = {
  id: string
  name: string
  tagline: string
  highlight?: boolean
  /** Free trial tier: rendered as "Free / 3 days" and ignores the billing toggle. */
  trial?: boolean
  badge?: string
  monthly: { perMo: number; sub: string }
  annual: { perMo: number; sub: string; save: string }
  features: string[]
  cta: string
  /** Where the card's CTA goes. Defaults to /signup when omitted. */
  href?: string
}

export const ANNUAL_BADGE = '3 days free'

export const PRICING_NOTE = 'Pricing is for launch and may change.'

// Prices shown in the UI. Checkout itself goes through Polar via
// /api/billing/checkout (see lib/billing). Pro is the default upsell.
export const PRO_PRICE = 30
export const STARTER_PRICE = 15

export const PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Free trial',
    tagline: 'Try Outloud with autopilot switched on',
    trial: true,
    badge: '3 days free',
    monthly: { perMo: 0, sub: '3 days free' },
    annual: { perMo: 0, sub: '3 days free', save: '' },
    features: [
      '3 days free, no card needed',
      'Autopilot switched on — watch it work',
      'Posts in your voice across X, LinkedIn & Threads',
      '10,000 credits for images & autopilot',
      'Voice capture from your existing posts',
    ],
    cta: 'Start free',
    href: '/signup',
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For builders who want to write and schedule on their own terms',
    monthly: { perMo: 15, sub: 'Billed monthly' },
    annual: { perMo: 10, sub: 'Billed annually · $120/year', save: 'Save 33%' },
    features: [
      'Posts in your authentic voice, matched to how you actually write',
      'Publish to X, LinkedIn, and Threads',
      'Schedule ahead on one shared calendar',
      'Unlimited posts',
      'Image generation + stock photos (credits)',
    ],
    cta: 'Get Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Everything in Starter, plus autopilot — so you never have to log in',
    highlight: true,
    badge: 'Most popular',
    monthly: { perMo: 30, sub: 'Billed monthly' },
    annual: { perMo: 20, sub: 'Billed annually · $240/year', save: 'Save 33%' },
    features: [
      'Pick a topic, set a time — Outloud writes and publishes for you',
      'Fully hands-off posting across all platforms',
      'Auto-fills the empty slots on your calendar',
      'Live links to every published post',
      'Everything in Starter',
    ],
    cta: 'Upgrade to Pro',
  },
]
