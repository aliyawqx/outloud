import { describe, expect, it } from 'vitest'
import { escapeLittleText, extractPostId } from './client'

describe('escapeLittleText', () => {
  it('escapes LinkedIn little-text reserved characters', () => {
    expect(escapeLittleText('a (b) {c} [d] @e <f> g|h ~i *j _k \\l')).toBe(
      'a \\(b\\) \\{c\\} \\[d\\] \\@e \\<f\\> g\\|h \\~i \\*j \\_k \\\\l',
    )
  })
  it('leaves plain text untouched', () => {
    expect(escapeLittleText('shipped a tiny fix today and it felt great')).toBe(
      'shipped a tiny fix today and it felt great',
    )
  })
})

describe('extractPostId', () => {
  it('prefers x-restli-id', () => {
    const h = new Headers({ 'x-restli-id': 'urn:li:share:123', 'x-linkedin-id': 'urn:li:share:456' })
    expect(extractPostId(h)).toBe('urn:li:share:123')
  })
  it('falls back to x-linkedin-id, else null', () => {
    expect(extractPostId(new Headers({ 'x-linkedin-id': 'urn:li:share:456' }))).toBe('urn:li:share:456')
    expect(extractPostId(new Headers())).toBeNull()
  })
})
