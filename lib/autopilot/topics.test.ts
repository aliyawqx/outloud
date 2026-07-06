import { describe, expect, it } from 'vitest'
import { matchTopics } from './topics'

describe('matchTopics', () => {
  it('suggests topics by substring, case-insensitive', () => {
    expect(matchTopics('build')).toContain('building in public')
    expect(matchTopics('BUILD')).toContain('building in public')
  })
  it('excludes already-added topics', () => {
    expect(matchTopics('build', ['building in public'])).not.toContain('building in public')
  })
  it('returns nothing for an empty query and caps the list', () => {
    expect(matchTopics('')).toEqual([])
    expect(matchTopics('a', [], 3).length).toBeLessThanOrEqual(3)
  })
})
