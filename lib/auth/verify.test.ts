import { describe, it, expect } from 'vitest'
import { decideVerify, generateCode } from './verify'

const now = new Date('2026-06-08T12:00:00Z')
const future = new Date('2026-06-08T12:10:00Z') // 10 min ahead
const past = new Date('2026-06-08T11:50:00Z') // 10 min ago

describe('decideVerify', () => {
  it('returns ok for the right, unexpired code', () => {
    expect(decideVerify({ emailVerified: false, code: '123456', expires: future }, '123456', now)).toBe('ok')
  })

  it('trims whitespace around the entered code', () => {
    expect(decideVerify({ emailVerified: false, code: '123456', expires: future }, ' 123456 ', now)).toBe('ok')
  })

  it('returns already when the user is verified (idempotent)', () => {
    expect(decideVerify({ emailVerified: true, code: null, expires: null }, '123456', now)).toBe('already')
  })

  it('returns expired when the code is past its expiry', () => {
    expect(decideVerify({ emailVerified: false, code: '123456', expires: past }, '123456', now)).toBe('expired')
  })

  it('returns invalid for the wrong code', () => {
    expect(decideVerify({ emailVerified: false, code: '123456', expires: future }, '000000', now)).toBe('invalid')
  })

  it('returns invalid when no code was ever set', () => {
    expect(decideVerify({ emailVerified: false, code: null, expires: null }, '123456', now)).toBe('invalid')
  })

  it('returns invalid when the row is missing', () => {
    expect(decideVerify(null, '123456', now)).toBe('invalid')
  })
})

describe('generateCode', () => {
  it('always returns a zero-padded 6-digit string', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/)
    }
  })
})
