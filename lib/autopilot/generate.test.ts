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

describe('pickInterest — slot-ordinal rotation (zero-touch addendum)', () => {
  const interests = ['ai tools', 'building in public']

  it('alternates topics across consecutive slot ordinals (no repeat within a day)', () => {
    const slot = new Date('2026-07-10T04:00:00Z')
    const day = Math.floor(slot.getTime() / 86_400_000)
    const a = pickInterest(interests, slot, day * 2 + 0)
    const b = pickInterest(interests, slot, day * 2 + 1)
    const c = pickInterest(interests, slot, (day + 1) * 2 + 0)
    expect(a).not.toBe(b) // two slots on the same day get different topics
    expect(c).toBe(a) // next day wraps around
  })

  it('falls back to day-based rotation when the ordinal is omitted', () => {
    const slot = new Date('2026-07-10T09:00:00Z')
    expect(pickInterest(interests, slot)).toBe(pickInterest(interests, slot))
  })
})
