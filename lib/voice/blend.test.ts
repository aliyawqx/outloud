import { describe, it, expect } from 'vitest'
import { blendProfile } from './blend'
import type { VoiceSource } from './types'

const src = (id: string, tags: string[], descriptor = `${id} writes tersely. Second sentence.`): VoiceSource => ({
  id,
  displayName: id.toUpperCase(),
  handle: id,
  avatarUrl: `https://unavatar.io/x/${id}`,
  styleDescriptor: descriptor,
  tags,
  exampleSnippets: [],
})

describe('blendProfile', () => {
  it('throws on an empty source list', () => {
    expect(() => blendProfile([])).toThrow(/at least one source/)
  })

  it('single source: returns its descriptor and tags', () => {
    const r = blendProfile([{ source: src('alice', ['punchy', 'dry']) }])
    expect(r.sources).toEqual([{ sourceId: 'alice', weight: 1 }])
    expect(r.mergedTags).toEqual(['punchy', 'dry'])
    expect(r.styleSummary).toContain('ALICE')
    expect(r.styleSummary).not.toContain('TODO') // no internal/phase text leaks into the profile
  })

  it('merges and dedupes tags preserving first appearance', () => {
    const r = blendProfile([
      { source: src('a', ['punchy', 'dry']) },
      { source: src('b', ['dry', 'technical']) },
    ])
    expect(r.mergedTags).toEqual(['punchy', 'dry', 'technical'])
  })

  it('defaults missing/invalid weights to 1', () => {
    const r = blendProfile([
      { source: src('a', ['x']) },
      { source: src('b', ['y']), weight: 0 },
      { source: src('c', ['z']), weight: -5 },
    ])
    expect(r.sources.map((s) => s.weight)).toEqual([1, 1, 1])
  })

  it('keeps provided weights', () => {
    const r = blendProfile([
      { source: src('a', ['x']), weight: 3 },
      { source: src('b', ['y']), weight: 1 },
    ])
    expect(r.sources.map((s) => s.weight)).toEqual([3, 1])
  })

  it('multi-source summary lists every creator and percentages summing to 100', () => {
    const r = blendProfile([
      { source: src('a', ['x']), weight: 3 },
      { source: src('b', ['y']), weight: 1 },
    ])
    expect(r.styleSummary).toContain('A hybrid voice blending A and B')
    // 3:1 → 75% / 25%
    expect(r.styleSummary).toContain('A (75%)')
    expect(r.styleSummary).toContain('B (25%)')
    const pcts = [...r.styleSummary.matchAll(/\((\d+)%\)/g)].map((m) => Number(m[1]))
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('three-source name list uses an Oxford comma', () => {
    const r = blendProfile([
      { source: src('a', ['x']) },
      { source: src('b', ['y']) },
      { source: src('c', ['z']) },
    ])
    expect(r.styleSummary).toContain('A, B, and C')
  })

  it('percentages always sum to 100 even with awkward splits', () => {
    const r = blendProfile([
      { source: src('a', ['x']) },
      { source: src('b', ['y']) },
      { source: src('c', ['z']) },
    ])
    const pcts = [...r.styleSummary.matchAll(/\((\d+)%\)/g)].map((m) => Number(m[1]))
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100)
  })
})
