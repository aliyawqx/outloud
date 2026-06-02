import { describe, it, expect } from 'vitest'
import { validateReplyInput } from './validateReply'

const ok = { samples: ['my post one', 'my post two'], replyTo: 'a popular post' }

describe('validateReplyInput', () => {
  it('accepts valid input and applies defaults', () => {
    const r = validateReplyInput(ok)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.samples).toEqual(['my post one', 'my post two'])
      expect(r.value.replyTo).toBe('a popular post')
      expect(r.value.hookIntensity).toBe('bold')
      expect(r.value.subtleHumor).toBe(true)
      expect(r.value.angle).toBeUndefined()
    }
  })

  it('trims samples and drops empty ones', () => {
    const r = validateReplyInput({ samples: ['  a  ', '', '   ', 'b'], replyTo: 'x' })
    expect(r.ok && r.value.samples).toEqual(['a', 'b'])
  })

  it('accepts no samples (voice is optional) — defaults to empty', () => {
    const r = validateReplyInput({ replyTo: 'x' })
    expect(r.ok && r.value.samples).toEqual([])
    const r2 = validateReplyInput({ samples: ['', '   '], replyTo: 'x' })
    expect(r2.ok && r2.value.samples).toEqual([])
  })

  it('rejects missing/empty replyTo', () => {
    expect(validateReplyInput({ samples: ['a'] }).ok).toBe(false)
    expect(validateReplyInput({ samples: ['a'], replyTo: '   ' }).ok).toBe(false)
  })

  it('rejects an invalid hook intensity', () => {
    expect(validateReplyInput({ ...ok, hookIntensity: 'loud' }).ok).toBe(false)
  })

  it('accepts each valid hook intensity and an angle', () => {
    for (const h of ['safe', 'bold', 'spicy', 'funny']) {
      const r = validateReplyInput({ ...ok, hookIntensity: h, angle: 'undercut the guru tone' })
      expect(r.ok && r.value.hookIntensity).toBe(h)
      expect(r.ok && r.value.angle).toBe('undercut the guru tone')
    }
  })

  it('rejects an over-long replyTo', () => {
    expect(validateReplyInput({ samples: ['a'], replyTo: 'x'.repeat(25001) }).ok).toBe(false)
  })

  it('coerces subtleHumor and respects false', () => {
    const r = validateReplyInput({ ...ok, subtleHumor: false })
    expect(r.ok && r.value.subtleHumor).toBe(false)
  })
})
