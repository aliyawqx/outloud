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
