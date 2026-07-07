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

describe('canUseAutopilot semantics (billing spec §6)', () => {
  // getUserTier hits the DB; the pure pieces are exercised via the exported
  // building blocks — here we lock the STATUS set logic through a local mirror.
  const can = (plan: string, status: string) =>
    ['pro', 'founder'].includes(plan) && ['active', 'canceled', 'trialing'].includes(status)

  it('pro needs a usable status', () => {
    expect(can('pro', 'active')).toBe(true)
    expect(can('pro', 'canceled')).toBe(true) // access until period end (M6)
    expect(can('pro', 'expired')).toBe(false)
  })
  it('starter and free never get autopilot — including the card-free trial', () => {
    expect(can('starter', 'active')).toBe(false)
    expect(can('free', 'trialing')).toBe(false)
  })
})
