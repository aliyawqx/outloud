import { describe, it, expect } from 'vitest'
import { validateSignup } from './validateSignup'

describe('validateSignup', () => {
  it('accepts a valid handle + email', () => {
    expect(validateSignup({ handle: 'jack_builds', email: 'jack@startup.com' })).toEqual({
      ok: true,
      value: { handle: 'jack_builds', email: 'jack@startup.com' },
    })
  })

  it('strips @ and lowercases handle + email', () => {
    const r = validateSignup({ handle: '  @Jack_Builds ', email: ' Jack@Startup.com ' })
    expect(r.ok && r.value).toEqual({ handle: 'jack_builds', email: 'jack@startup.com' })
  })

  it('rejects a missing/invalid handle', () => {
    expect(validateSignup({ email: 'a@b.com' }).ok).toBe(false)
    expect(validateSignup({ handle: 'bad handle!', email: 'a@b.com' }).ok).toBe(false)
    expect(validateSignup({ handle: 'a'.repeat(16), email: 'a@b.com' }).ok).toBe(false)
  })

  it('rejects a missing/invalid email', () => {
    expect(validateSignup({ handle: 'jack' }).ok).toBe(false)
    expect(validateSignup({ handle: 'jack', email: 'nope' }).ok).toBe(false)
  })
})
