import { beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { decryptToken, encryptToken } from './crypto'

beforeEach(() => {
  process.env.X_TOKEN_ENC_KEY = randomBytes(32).toString('base64')
})

describe('token crypto', () => {
  it('round-trips a token', () => {
    const secret = 'access-token-abc.123'
    expect(decryptToken(encryptToken(secret))).toBe(secret)
  })

  it('produces different ciphertext each time (random IV)', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'))
  })

  it('throws on a tampered payload', () => {
    const enc = encryptToken('secret')
    const tampered = enc.slice(0, -4) + (enc.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('throws when the key is the wrong size', () => {
    process.env.X_TOKEN_ENC_KEY = randomBytes(16).toString('base64')
    expect(() => encryptToken('x')).toThrow(/32 bytes/)
  })
})
