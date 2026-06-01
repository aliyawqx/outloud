import { describe, it, expect } from 'vitest'
import { validateSignup } from './validateSignup'

describe('validateSignup', () => {
  it('accepts a valid handle + shipping', () => {
    expect(validateSignup({ handle: 'jack_builds', shipping: 'Friends Map, $6k MRR' })).toEqual({
      ok: true,
      value: { handle: 'jack_builds', shipping: 'Friends Map, $6k MRR' },
    })
  })

  it('strips a leading @ and lowercases the handle', () => {
    const r = validateSignup({ handle: '  @Jack_Builds ' })
    expect(r.ok && r.value.handle).toBe('jack_builds')
  })

  it('treats missing/empty shipping as null', () => {
    const r = validateSignup({ handle: 'jack' })
    expect(r.ok && r.value.shipping).toBe(null)
    const r2 = validateSignup({ handle: 'jack', shipping: '   ' })
    expect(r2.ok && r2.value.shipping).toBe(null)
  })

  it('rejects a missing handle', () => {
    expect(validateSignup({ shipping: 'hi' }).ok).toBe(false)
  })

  it('rejects an invalid handle (spaces / symbols / too long)', () => {
    expect(validateSignup({ handle: 'not a handle' }).ok).toBe(false)
    expect(validateSignup({ handle: 'bad!' }).ok).toBe(false)
    expect(validateSignup({ handle: 'a'.repeat(16) }).ok).toBe(false)
  })

  it('rejects shipping over 280 characters', () => {
    expect(validateSignup({ handle: 'jack', shipping: 'x'.repeat(281) }).ok).toBe(false)
  })
})
