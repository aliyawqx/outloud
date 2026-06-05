import { beforeEach, describe, expect, it } from 'vitest'
import { openOAuthTx, sealOAuthTx } from './stateCookie'

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-chars-long-xx'
})

describe('oauth tx cookie', () => {
  it('round-trips state + verifier', async () => {
    const token = await sealOAuthTx({ state: 'st', verifier: 'vf' })
    expect(await openOAuthTx(token)).toEqual({ state: 'st', verifier: 'vf' })
  })

  it('returns null for a missing token', async () => {
    expect(await openOAuthTx(undefined)).toBeNull()
  })

  it('returns null for a tampered token', async () => {
    const token = await sealOAuthTx({ state: 'st', verifier: 'vf' })
    expect(await openOAuthTx(token + 'x')).toBeNull()
  })
})
