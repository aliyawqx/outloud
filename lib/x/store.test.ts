import { describe, expect, it } from 'vitest'
import { isExpiring } from './store'

describe('isExpiring', () => {
  const now = new Date('2026-06-05T12:00:00Z')

  it('true when the token is already expired', () => {
    expect(isExpiring(new Date('2026-06-05T11:59:00Z'), now)).toBe(true)
  })

  it('true within the 60s refresh skew', () => {
    expect(isExpiring(new Date('2026-06-05T12:00:30Z'), now)).toBe(true)
  })

  it('false when comfortably valid', () => {
    expect(isExpiring(new Date('2026-06-05T13:00:00Z'), now)).toBe(false)
  })
})
