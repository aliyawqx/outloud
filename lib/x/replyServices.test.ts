import { describe, it, expect } from 'vitest'
import { tweetIdFromUrl } from './fetchPost'
import { computeReachScore } from './search'
import { replyIntentUrl } from './replyIntent'

describe('tweetIdFromUrl', () => {
  it('parses x.com and twitter.com status URLs, with params and subdomains', () => {
    expect(tweetIdFromUrl('https://x.com/jack/status/20')).toBe('20')
    expect(tweetIdFromUrl('https://twitter.com/jack/status/1234567890?s=20&t=abc')).toBe('1234567890')
    expect(tweetIdFromUrl('https://www.x.com/u/status/999')).toBe('999')
    expect(tweetIdFromUrl('https://mobile.twitter.com/u/status/555')).toBe('555')
    expect(tweetIdFromUrl('https://x.com/i/web/status/42')).toBe('42')
  })

  it('rejects non-post and non-X URLs', () => {
    expect(tweetIdFromUrl('https://x.com/jack')).toBeNull()
    expect(tweetIdFromUrl('https://example.com/status/20')).toBeNull()
    expect(tweetIdFromUrl('not a url')).toBeNull()
    expect(tweetIdFromUrl('')).toBeNull()
  })
})

describe('computeReachScore', () => {
  it('rises with engagement and followers', () => {
    const small = computeReachScore({ followers: 200, likes: 1, replies: 0, reposts: 0, quotes: 0 })
    const big = computeReachScore({ followers: 500_000, likes: 800, replies: 120, reposts: 300, quotes: 40 })
    expect(big).toBeGreaterThan(small)
  })

  it('gives a freshness bonus to fast-climbing posts', () => {
    const base = { followers: 10_000, likes: 100, replies: 10, reposts: 20, quotes: 5 }
    const fresh = computeReachScore({ ...base, ageHours: 1 })
    const old = computeReachScore({ ...base, ageHours: 48 })
    expect(fresh).toBeGreaterThan(old)
  })
})

describe('replyIntentUrl', () => {
  it('builds an X intent URL set to reply to the post, with encoded text', () => {
    const url = replyIntentUrl('123', 'hello & welcome')
    expect(url).toContain('https://x.com/intent/tweet?')
    expect(url).toContain('in_reply_to=123')
    expect(url).toMatch(/text=hello(\+|%20)%26(\+|%20)welcome/)
  })
})
