import { vi, describe, it, expect, beforeEach } from 'vitest'

const { draftsMock } = vi.hoisted(() => ({ draftsMock: vi.fn() }))
vi.mock('@/lib/anthropic', () => ({ generateDrafts: draftsMock }))

import { toVoiceInput, generatePost, VoiceNotReadyError } from './generate'
import type { VoiceProfile } from './types'

const base: VoiceProfile = {
  id: 'p', ownerKey: 'u', kind: 'own', name: 'Me', sources: [], mergedTags: [],
  styleSummary: '', styleGuide: '', channel: 'x', isActive: true, createdAt: '', updatedAt: '',
}
const own = (o: Partial<VoiceProfile> = {}): VoiceProfile => ({ ...base, ...o })
const insp = (o: Partial<VoiceProfile> = {}): VoiceProfile =>
  ({ ...base, kind: 'inspiration', sources: [{ sourceId: 'naval', weight: 1 }], ...o })

describe('toVoiceInput', () => {
  it('own voice with a guide → style guide + sample anchors', () => {
    const v = toVoiceInput(own({ styleGuide: '## Tone\nblunt' }), ['my real post'])
    expect(v.styleGuide).toContain('blunt')
    expect(v.samples).toEqual(['my real post'])
  })

  it('own voice with samples but no guide → still usable (anchors only)', () => {
    const v = toVoiceInput(own({ styleGuide: '' }), ['my real post'])
    expect(v.styleGuide).toBeUndefined()
    expect(v.samples).toEqual(['my real post'])
  })

  it('own voice with no guide and no samples → not ready', () => {
    expect(() => toVoiceInput(own({ styleGuide: '' }), [])).toThrow(VoiceNotReadyError)
  })

  it('inspiration blend → weighted descriptor summary from the catalog', () => {
    const v = toVoiceInput(insp())
    expect(v.summary).toContain('HYBRID')
    expect(v.summary).toContain('Naval')
  })

  it('single creator with a full Style Guide drives on that guide, not the descriptor', () => {
    const v = toVoiceInput(insp({ sources: [{ sourceId: 'elon-musk', weight: 1 }] }))
    expect(v.styleGuide).toContain('Terse, confident')
    expect(v.summary).toBeUndefined() // single guide → no HYBRID blend wording
  })

  it('blend of a guided + non-guided creator stacks them by weight', () => {
    const v = toVoiceInput(insp({ sources: [{ sourceId: 'elon-musk', weight: 3 }, { sourceId: 'naval', weight: 1 }] }))
    expect(v.styleGuide).toContain('Elon Musk')
    expect(v.styleGuide).toContain('Naval') // naval falls back to its descriptor inside the stack
    expect(v.summary).toContain('HYBRID')
  })
})

describe('generatePost', () => {
  beforeEach(() => draftsMock.mockReset())

  it('drives generateDrafts in ship mode with progress counter + clamped count', async () => {
    draftsMock.mockResolvedValue({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'f' }], clarify: '' })
    const { drafts } = await generatePost({
      idea: 'shipped billing',
      voiceProfile: own({ styleGuide: '## Tone\nblunt' }),
      samples: ['anchor'],
      count: 9, // clamps to 4
      hookIntensity: 'spicy',
      progressDay: 5,
      progressTotal: 30,
      followerCount: 340,
    })
    expect(drafts).toHaveLength(1)
    const [voice, opts] = draftsMock.mock.calls[0]
    expect(voice.styleGuide).toContain('blunt')
    expect(opts.kind).toBe('ship')
    expect(opts.count).toBe(4)
    expect(opts.hookIntensity).toBe('spicy')
    expect(opts.progressDay).toBe(5)
    expect(opts.progressTotal).toBe(30)
    expect(opts.followerCount).toBe(340)
  })
})
