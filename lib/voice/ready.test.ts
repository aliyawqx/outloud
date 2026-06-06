import { describe, expect, it } from 'vitest'
import { hasReadyVoice, isVoiceReady } from './ready'
import type { VoiceProfile } from './types'

const base: VoiceProfile = {
  id: 'p1', ownerKey: 'u1', kind: 'own', name: 'My voice', sources: [], mergedTags: [],
  styleSummary: '', styleGuide: '', channel: 'x', isActive: true, createdAt: '', updatedAt: '',
}

describe('isVoiceReady', () => {
  it('own voice is ready once a Style Guide is extracted', () => {
    expect(isVoiceReady({ ...base, styleGuide: '' })).toBe(false)
    expect(isVoiceReady({ ...base, styleGuide: '## Voice\ndry' })).toBe(true)
  })

  it('own voice with samples but no guide is NOT ready (must finish extraction)', () => {
    // styleGuide empty regardless of samples → onboarding not complete
    expect(isVoiceReady({ ...base, styleGuide: '   ' })).toBe(false)
  })

  it('inspiration blend is ready when it has sources', () => {
    expect(isVoiceReady({ ...base, kind: 'inspiration', sources: [] })).toBe(false)
    expect(isVoiceReady({ ...base, kind: 'inspiration', sources: [{ sourceId: 'x', weight: 1 }] })).toBe(true)
  })
})

describe('hasReadyVoice', () => {
  it('false for a brand-new user with no profiles', () => {
    expect(hasReadyVoice([])).toBe(false)
  })
  it('true when at least one profile is ready', () => {
    expect(hasReadyVoice([{ ...base, styleGuide: '' }, { ...base, id: 'p2', styleGuide: '## g' }])).toBe(true)
  })
})
