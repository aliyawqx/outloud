import { describe, expect, it } from 'vitest'
import { sanitizeRef } from './refShared'

describe('sanitizeRef', () => {
  it('accepts simple campaign slugs', () => {
    expect(sanitizeRef('ph')).toBe('ph')
    expect(sanitizeRef('product-hunt_2026')).toBe('product-hunt_2026')
    expect(sanitizeRef('  ph  ')).toBe('ph')
  })
  it('rejects empty, junk, and oversized values', () => {
    expect(sanitizeRef(null)).toBeNull()
    expect(sanitizeRef(undefined)).toBeNull()
    expect(sanitizeRef('')).toBeNull()
    expect(sanitizeRef('a b')).toBeNull()
    expect(sanitizeRef('<script>')).toBeNull()
    expect(sanitizeRef('a'.repeat(65))).toBeNull()
  })
})
