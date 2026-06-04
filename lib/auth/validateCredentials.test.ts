import { describe, it, expect } from 'vitest'
import { validateSignup, validateLogin } from './validateCredentials'

describe('validateSignup', () => {
  it('accepts valid input and lowercases the email', () => {
    const r = validateSignup({ email: 'Aya@Example.COM', password: 'supersecret', displayName: 'Aya' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ email: 'aya@example.com', password: 'supersecret', displayName: 'Aya' })
  })

  it('defaults the display name to the email local-part', () => {
    const r = validateSignup({ email: 'builder@x.com', password: 'supersecret' })
    expect(r.ok && r.value.displayName).toBe('builder')
  })

  it('rejects bad emails and short passwords', () => {
    expect(validateSignup({ email: 'nope', password: 'supersecret' }).ok).toBe(false)
    expect(validateSignup({ email: 'a@b.com', password: 'short' }).ok).toBe(false)
  })
})

describe('validateLogin', () => {
  it('accepts valid input', () => {
    expect(validateLogin({ email: 'a@b.com', password: 'x' }).ok).toBe(true)
  })
  it('rejects missing fields', () => {
    expect(validateLogin({ email: 'a@b.com' }).ok).toBe(false)
    expect(validateLogin({ password: 'x' }).ok).toBe(false)
  })
})
