import { describe, expect, it } from 'vitest'
import { estimateMonthlyCredits } from './estimate'
import { COST_PER_AI_PHOTO, COST_PER_AUTO_POST } from '@/lib/creditsConfig'

describe('estimateMonthlyCredits', () => {
  it('one every-day slot ≈ 30 posts a month', () => {
    const e = estimateMonthlyCredits([{ time: '09:00' }], false)
    expect(e.postsPerMonth).toBe(30)
    expect(e.perPost).toBe(COST_PER_AUTO_POST)
    expect(e.creditsPerMonth).toBe(30 * COST_PER_AUTO_POST)
  })

  it('day-limited slots count only their weekdays (rounded up)', () => {
    // Mon+Wed+Fri = 3 slots/week → ceil(3*30/7) = 13 posts.
    const e = estimateMonthlyCredits([{ time: '09:00', days: [1, 3, 5] }], false)
    expect(e.postsPerMonth).toBe(13)
  })

  it('AI images stack their cost onto every post', () => {
    const e = estimateMonthlyCredits([{ time: '09:00' }], true)
    expect(e.perPost).toBe(COST_PER_AUTO_POST + COST_PER_AI_PHOTO)
    expect(e.creditsPerMonth).toBe(30 * e.perPost)
  })

  it('empty schedule costs nothing', () => {
    expect(estimateMonthlyCredits([], true).creditsPerMonth).toBe(0)
  })
})
