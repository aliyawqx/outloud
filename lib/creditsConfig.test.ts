import { describe, expect, it } from 'vitest'
import {
  COST_PER_POST,
  COST_PER_REPLY,
  COST_PER_LINK_SEARCH,
  COST_PER_TOPIC_SEARCH,
  COST_PER_AI_PHOTO,
  COST_PER_GOOGLE_PHOTO,
  COST_UPLOAD_PHOTO,
  PLAN_ALLOWANCE,
  SIGNUP_GRANT,
  planAllowance,
  CREDIT_PACKS,
  packById,
} from './creditsConfig'

describe('credit config', () => {
  it('uses the locked action costs', () => {
    expect(COST_PER_POST).toBe(1_000)
    expect(COST_PER_REPLY).toBe(5_000)
    expect(COST_PER_LINK_SEARCH).toBe(5_000)
    expect(COST_PER_TOPIC_SEARCH).toBe(10_000)
    expect(COST_PER_AI_PHOTO).toBe(2_000)
    expect(COST_PER_GOOGLE_PHOTO).toBe(1_000)
    expect(COST_UPLOAD_PHOTO).toBe(0)
  })

  it('uses the locked plan allowances', () => {
    expect(PLAN_ALLOWANCE).toMatchObject({ free: 10_000, starter: 200_000, pro: 600_000 })
    expect(SIGNUP_GRANT).toBe(10_000)
  })

  it('planAllowance falls back to the free pool for unknown plans', () => {
    expect(planAllowance('pro')).toBe(600_000)
    expect(planAllowance('mystery')).toBe(10_000)
  })

  it('packById resolves known packs and rejects unknown', () => {
    expect(packById('pack_100k')?.credits).toBe(100_000)
    expect(packById('nope')).toBeNull()
  })

  it('locked top-up prices, with exactly one best-value pack', () => {
    expect(packById('pack_100k')?.priceUsd).toBe(10)
    expect(packById('pack_500k')?.priceUsd).toBe(40)
    expect(packById('pack_1m')?.priceUsd).toBe(70)
    expect(CREDIT_PACKS.filter((p) => p.bestValue)).toHaveLength(1)
    expect(packById('pack_500k')?.bestValue).toBe(true)
  })

  it('every pack has credits, a price and a Polar product env', () => {
    for (const p of CREDIT_PACKS) {
      expect(p.credits).toBeGreaterThan(0)
      expect(p.priceUsd).toBeGreaterThan(0)
      expect(p.productEnv).toMatch(/^POLAR_PACK_/)
    }
  })
})
