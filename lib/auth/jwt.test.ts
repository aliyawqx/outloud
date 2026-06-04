import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret-1234'
})

describe('session tokens', () => {
  it('round-trips a valid session', async () => {
    const { createSessionToken, verifySessionToken } = await import('./jwt')
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.com' })
    expect(await verifySessionToken(token)).toEqual({ userId: 'u1', email: 'a@b.com' })
  })

  it('rejects a tampered / empty token', async () => {
    const { createSessionToken, verifySessionToken } = await import('./jwt')
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.com' })
    expect(await verifySessionToken(token + 'x')).toBeNull()
    expect(await verifySessionToken(undefined)).toBeNull()
    expect(await verifySessionToken('not.a.jwt')).toBeNull()
  })
})
