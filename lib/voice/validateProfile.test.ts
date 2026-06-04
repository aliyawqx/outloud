import { describe, it, expect } from 'vitest'
import { validateCreateProfile, validateUpdateProfile } from './validateProfile'

describe('validateCreateProfile', () => {
  it('accepts a valid inspiration blend with defaults', () => {
    const r = validateCreateProfile({ name: 'My blend', sources: [{ sourceId: 'naval' }] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.name).toBe('My blend')
      expect(r.value.kind).toBe('inspiration')
      expect(r.value.sources).toEqual([{ sourceId: 'naval', weight: 1 }])
      expect(r.value.isActive).toBe(false)
    }
  })

  it('requires a name', () => {
    expect(validateCreateProfile({ sources: [{ sourceId: 'naval' }] }).ok).toBe(false)
    expect(validateCreateProfile({ name: '   ', sources: [{ sourceId: 'naval' }] }).ok).toBe(false)
  })

  it('rejects an over-long name', () => {
    expect(validateCreateProfile({ name: 'x'.repeat(81), sources: [{ sourceId: 'a' }] }).ok).toBe(false)
  })

  it('requires at least one source for an inspiration profile', () => {
    const r = validateCreateProfile({ name: 'empty', sources: [] })
    expect(r.ok).toBe(false)
  })

  it('allows an own voice with no sources', () => {
    const r = validateCreateProfile({ name: 'Me', kind: 'own', sources: [{ sourceId: 'ignored' }] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('own')
      expect(r.value.sources).toEqual([]) // sources stripped for own voices
    }
  })

  it('dedupes sources by id', () => {
    const r = validateCreateProfile({
      name: 'dupes',
      sources: [{ sourceId: 'a' }, { sourceId: 'a', weight: 5 }, { sourceId: 'b' }],
    })
    expect(r.ok && r.value.sources).toEqual([
      { sourceId: 'a', weight: 1 },
      { sourceId: 'b', weight: 1 },
    ])
  })

  it('rejects invalid weights', () => {
    expect(validateCreateProfile({ name: 'n', sources: [{ sourceId: 'a', weight: 0 }] }).ok).toBe(false)
    expect(validateCreateProfile({ name: 'n', sources: [{ sourceId: 'a', weight: -1 }] }).ok).toBe(false)
    expect(validateCreateProfile({ name: 'n', sources: [{ sourceId: 'a', weight: 999 }] }).ok).toBe(false)
  })

  it('caps the blend size at 5 creators', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ sourceId: `s${i}` }))
    expect(validateCreateProfile({ name: 'big', sources: many }).ok).toBe(false)
  })

  it('rejects an invalid kind', () => {
    expect(validateCreateProfile({ name: 'n', kind: 'robot', sources: [{ sourceId: 'a' }] }).ok).toBe(false)
  })
})

describe('validateUpdateProfile', () => {
  it('accepts a partial name update', () => {
    const r = validateUpdateProfile({ name: 'Renamed' })
    expect(r.ok && r.value).toEqual({ name: 'Renamed' })
  })

  it('accepts a sources update', () => {
    const r = validateUpdateProfile({ sources: [{ sourceId: 'a', weight: 2 }] })
    expect(r.ok && r.value.sources).toEqual([{ sourceId: 'a', weight: 2 }])
  })

  it('accepts an isActive toggle', () => {
    const r = validateUpdateProfile({ isActive: true })
    expect(r.ok && r.value).toEqual({ isActive: true })
  })

  it('rejects an empty patch', () => {
    expect(validateUpdateProfile({}).ok).toBe(false)
  })

  it('propagates field validation errors', () => {
    expect(validateUpdateProfile({ name: '   ' }).ok).toBe(false)
    expect(validateUpdateProfile({ sources: 'nope' }).ok).toBe(false)
  })
})
