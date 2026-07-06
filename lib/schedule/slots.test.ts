import { describe, expect, it } from 'vitest'
import { dateInTz, isValidTimeZone, slotRankInDay, upcomingSlots, zonedTimeToUtc } from './slots'

describe('zonedTimeToUtc', () => {
  it('converts fixed-offset zones (Asia/Almaty, UTC+5)', () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, 'Asia/Almaty').toISOString()).toBe('2026-01-15T04:00:00.000Z')
  })
  it('handles winter vs summer offsets (America/New_York)', () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, 'America/New_York').toISOString()).toBe('2026-01-15T14:00:00.000Z')
    expect(zonedTimeToUtc(2026, 7, 15, 9, 0, 'America/New_York').toISOString()).toBe('2026-07-15T13:00:00.000Z')
  })
  it('maps a nonexistent spring-forward time to a stable instant', () => {
    // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00→03:00).
    expect(zonedTimeToUtc(2026, 3, 8, 2, 30, 'America/New_York').toISOString()).toBe('2026-03-08T06:30:00.000Z')
  })
  it('picks the first occurrence of an ambiguous fall-back time', () => {
    // 2026-11-01 01:30 happens twice in New York; we take the EDT (first) one.
    expect(zonedTimeToUtc(2026, 11, 1, 1, 30, 'America/New_York').toISOString()).toBe('2026-11-01T05:30:00.000Z')
  })
})

describe('dateInTz', () => {
  it('returns the calendar date in the zone, not UTC', () => {
    // 2026-01-15T22:00Z is already Jan 16 in Almaty (UTC+5).
    expect(dateInTz(new Date('2026-01-15T22:00:00Z'), 'Asia/Almaty')).toEqual({ y: 2026, m: 1, d: 16 })
  })
})

describe('isValidTimeZone', () => {
  it('accepts real zones and rejects junk', () => {
    expect(isValidTimeZone('Asia/Almaty')).toBe(true)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
  })
})

describe('upcomingSlots', () => {
  const daily9 = { postingTimes: [{ time: '09:00' }], timezone: 'Asia/Almaty', slotsPerDay: 1 }

  it('returns the next slot inside the horizon', () => {
    // now = 07:00 local; 09:00 local = 04:00Z is 2h away, within 240 min.
    const slots = upcomingSlots(daily9, new Date('2026-01-15T02:00:00Z'), 240)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-15T04:00:00.000Z'])
  })

  it('excludes slots outside the horizon and in the past', () => {
    // now = 10:00 local — today's 09:00 has passed; tomorrow's is beyond 240 min.
    expect(upcomingSlots(daily9, new Date('2026-01-15T05:00:00Z'), 240)).toEqual([])
  })

  it('caps slots per day BEFORE filtering out past times', () => {
    // Two posting times but slotsPerDay=1: after 09:00 passes, 18:00 must NOT
    // become the day's slot — the day's quota was 09:00 only.
    const cfg = { postingTimes: [{ time: '09:00' }, { time: '18:00' }], timezone: 'Asia/Almaty', slotsPerDay: 1 }
    const slots = upcomingSlots(cfg, new Date('2026-01-15T05:00:00Z'), 2 * 1440)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-16T04:00:00.000Z', '2026-01-17T04:00:00.000Z'])
  })

  it('respects the days-of-week filter', () => {
    // 2026-01-15 is a Thursday (4). Mondays-only → next slot is Mon Jan 19.
    const cfg = { postingTimes: [{ time: '09:00', days: [1] }], timezone: 'Asia/Almaty', slotsPerDay: 1 }
    const slots = upcomingSlots(cfg, new Date('2026-01-15T02:00:00Z'), 7 * 1440)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-19T04:00:00.000Z'])
  })

  it('returns two slots per day when configured', () => {
    const cfg = { postingTimes: [{ time: '09:00' }, { time: '18:00' }], timezone: 'Asia/Almaty', slotsPerDay: 2 }
    const slots = upcomingSlots(cfg, new Date('2026-01-15T02:00:00Z'), 1440)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-15T04:00:00.000Z', '2026-01-15T13:00:00.000Z'])
  })

  it('ignores malformed time strings', () => {
    const cfg = { postingTimes: [{ time: 'garbage' }], timezone: 'Asia/Almaty', slotsPerDay: 1 }
    expect(upcomingSlots(cfg, new Date('2026-01-15T02:00:00Z'), 1440)).toEqual([])
  })

  it('falls back to 1 slot/day when slotsPerDay is NaN', () => {
    const cfg = { postingTimes: [{ time: '09:00' }], timezone: 'Asia/Almaty', slotsPerDay: Number.NaN }
    const slots = upcomingSlots(cfg, new Date('2026-01-15T02:00:00Z'), 240)
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-01-15T04:00:00.000Z'])
  })
})

describe('slotRankInDay', () => {
  const cfg2 = { postingTimes: [{ time: '09:00' }, { time: '18:00' }], timezone: 'Asia/Almaty', slotsPerDay: 2 }

  it('ranks a slot among its day quota slots', () => {
    // 2026-01-15 Asia/Almaty: 09:00 = 04:00Z (rank 0), 18:00 = 13:00Z (rank 1)
    expect(slotRankInDay(cfg2, new Date('2026-01-15T04:00:00Z'))).toBe(0)
    expect(slotRankInDay(cfg2, new Date('2026-01-15T13:00:00Z'))).toBe(1)
  })

  it('returns 0 for an unmatched instant', () => {
    expect(slotRankInDay(cfg2, new Date('2026-01-15T05:30:00Z'))).toBe(0)
  })

  it('caps by the day quota — an over-quota time never appears', () => {
    const cfg1 = { ...cfg2, slotsPerDay: 1 }
    expect(slotRankInDay(cfg1, new Date('2026-01-15T13:00:00Z'))).toBe(0) // 18:00 is outside quota 1
  })
})
