import { describe, expect, it } from 'vitest'
import { pickInterest } from './generate'

describe('pickInterest', () => {
  const interests = ['ai tools', 'building in public', 'indie revenue']

  it('is deterministic for the same slot', () => {
    const slot = new Date('2026-07-10T09:00:00Z')
    expect(pickInterest(interests, slot)).toBe(pickInterest(interests, slot))
  })

  it('rotates across consecutive days', () => {
    const a = pickInterest(interests, new Date('2026-07-10T09:00:00Z'))
    const b = pickInterest(interests, new Date('2026-07-11T09:00:00Z'))
    const c = pickInterest(interests, new Date('2026-07-12T09:00:00Z'))
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('handles a single interest', () => {
    expect(pickInterest(['ai'], new Date('2026-07-10T09:00:00Z'))).toBe('ai')
  })
})
