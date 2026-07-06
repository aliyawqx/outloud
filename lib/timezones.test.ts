import { describe, expect, it } from 'vitest'
import { timezoneOptions } from './timezones'

describe('timezoneOptions', () => {
  const opts = timezoneOptions(new Date('2026-01-15T12:00:00Z'))

  it('labels zones with their GMT offset', () => {
    const almaty = opts.find((o) => o.value === 'Asia/Almaty')
    expect(almaty?.label).toBe('(GMT+05:00) Asia/Almaty')
    expect(almaty?.offsetMin).toBe(300)
  })

  it('handles negative and half-hour offsets', () => {
    const denver = opts.find((o) => o.value === 'America/Denver') // GMT-7 in January
    expect(denver?.offsetMin).toBe(-420)
    expect(denver?.label).toContain('(GMT-07:00)')
    // Node may canonicalize Kolkata→Calcutta; assert a half-hour zone exists either way.
    const halfHour = opts.find((o) => o.offsetMin === 330)
    expect(halfHour?.label).toContain('(GMT+05:30)')
  })

  it('sorts by offset ascending', () => {
    const mins = opts.map((o) => o.offsetMin)
    expect([...mins].sort((a, b) => a - b)).toEqual(mins)
  })
})
