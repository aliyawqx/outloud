import { describe, expect, it } from 'vitest'
import { parseMedia, parsePlatforms } from './parse'

describe('parsePlatforms', () => {
  it('accepts valid platforms', () => {
    expect(parsePlatforms(['x'])).toEqual(['x'])
    expect(parsePlatforms(['x', 'threads'])).toEqual(['x', 'threads'])
  })
  it('dedupes repeats', () => {
    expect(parsePlatforms(['x', 'x', 'threads'])).toEqual(['x', 'threads'])
  })
  it('rejects the whole list when ANY platform is unknown', () => {
    expect(parsePlatforms(['x', 'instagram'])).toBeNull()
    expect(parsePlatforms(['facebook'])).toBeNull()
  })
  it('rejects non-arrays', () => {
    expect(parsePlatforms('x')).toBeNull()
    expect(parsePlatforms(null)).toBeNull()
    expect(parsePlatforms(undefined)).toBeNull()
    expect(parsePlatforms({ 0: 'x' })).toBeNull()
  })
  it('rejects an empty array', () => {
    expect(parsePlatforms([])).toBeNull()
  })
})

describe('parseMedia', () => {
  it('treats null/undefined/[] as "no media"', () => {
    expect(parseMedia(null)).toBeNull()
    expect(parseMedia(undefined)).toBeNull()
    expect(parseMedia([])).toBeNull()
  })
  it('flags a non-array value as invalid', () => {
    expect(parseMedia('oops')).toBe('invalid')
    expect(parseMedia(42)).toBe('invalid')
    expect(parseMedia({ url: 'https://a.example/x.png' })).toBe('invalid')
  })
  it('flags items without a string url as invalid', () => {
    expect(parseMedia([{ alt: 'no url' }])).toBe('invalid')
    expect(parseMedia([{ url: 123 }])).toBe('invalid')
    expect(parseMedia([null])).toBe('invalid')
    expect(parseMedia([{ url: 'https://a.example/ok.png' }, 'oops'])).toBe('invalid')
  })
  it('parses valid items, keeping only string alt', () => {
    expect(parseMedia([{ url: 'https://a.example/x.png' }])).toEqual([{ url: 'https://a.example/x.png' }])
    expect(parseMedia([{ url: 'https://a.example/x.png', alt: 'pic' }])).toEqual([
      { url: 'https://a.example/x.png', alt: 'pic' },
    ])
    expect(parseMedia([{ url: 'https://a.example/x.png', alt: 7 }])).toEqual([{ url: 'https://a.example/x.png' }])
  })
  it('truncates to 4 items', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ url: `https://a.example/${i}.png` }))
    const out = parseMedia(items)
    expect(out).toHaveLength(4)
    expect((out as { url: string }[])[3].url).toBe('https://a.example/3.png')
  })
})
