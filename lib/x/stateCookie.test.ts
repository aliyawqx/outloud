import { beforeEach, describe, expect, it } from 'vitest'
import { openOAuthTx, safeReturnTo, sealOAuthTx } from './stateCookie'

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-chars-long-xx'
})

describe('oauth tx cookie', () => {
  it('round-trips state + verifier', async () => {
    const token = await sealOAuthTx({ state: 'st', verifier: 'vf' })
    expect(await openOAuthTx(token)).toEqual({ state: 'st', verifier: 'vf' })
  })

  it('round-trips an optional returnTo', async () => {
    const token = await sealOAuthTx({ state: 'st', verifier: 'vf', returnTo: '/app/onboarding' })
    expect(await openOAuthTx(token)).toEqual({ state: 'st', verifier: 'vf', returnTo: '/app/onboarding' })
  })

  it('returns null for a missing token', async () => {
    expect(await openOAuthTx(undefined)).toBeNull()
  })

  it('returns null for a tampered token', async () => {
    const token = await sealOAuthTx({ state: 'st', verifier: 'vf' })
    expect(await openOAuthTx(token + 'x')).toBeNull()
  })
})

describe('safeReturnTo', () => {
  it('allows internal /app paths', () => {
    expect(safeReturnTo('/app/onboarding')).toBe('/app/onboarding')
    expect(safeReturnTo('/app/profile?x=connected')).toBe('/app/profile?x=connected')
  })

  it('falls back to /app/profile for missing or non-app paths', () => {
    expect(safeReturnTo(null)).toBe('/app/profile')
    expect(safeReturnTo(undefined)).toBe('/app/profile')
    expect(safeReturnTo('/login')).toBe('/app/profile')
    expect(safeReturnTo('app/onboarding')).toBe('/app/profile') // not slash-rooted
  })

  it('rejects open-redirect attempts', () => {
    expect(safeReturnTo('//evil.com')).toBe('/app/profile')
    expect(safeReturnTo('/\\evil.com')).toBe('/app/profile')
    expect(safeReturnTo('https://evil.com')).toBe('/app/profile')
  })
})
