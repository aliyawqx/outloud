import { describe, it, expect } from 'vitest'
import { validateProfileUpdate } from './validate'

describe('validateProfileUpdate', () => {
  it('accepts a display name', () => {
    const r = validateProfileUpdate({ displayName: '  Aya  ' })
    expect(r.ok && r.value).toEqual({ displayName: 'Aya' })
  })

  it('strips a leading @ from the handle', () => {
    const r = validateProfileUpdate({ handle: '@builder' })
    expect(r.ok && r.value.handle).toBe('builder')
  })

  it('clears handle/avatar when blank', () => {
    const r = validateProfileUpdate({ handle: '', avatarUrl: '' })
    expect(r.ok && r.value).toEqual({ handle: null, avatarUrl: null })
  })

  it('rejects an invalid handle or avatar url', () => {
    expect(validateProfileUpdate({ handle: 'way-too-long-and-bad!' }).ok).toBe(false)
    expect(validateProfileUpdate({ avatarUrl: 'not-a-url' }).ok).toBe(false)
  })

  it('rejects an empty patch and an empty name', () => {
    expect(validateProfileUpdate({}).ok).toBe(false)
    expect(validateProfileUpdate({ displayName: '   ' }).ok).toBe(false)
  })
})
