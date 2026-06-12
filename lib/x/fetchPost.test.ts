import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPost, fetchViaFx } from './fetchPost'

afterEach(() => vi.unstubAllGlobals())

const fxJson = (overrides: Record<string, unknown> = {}) => ({
  tweet: {
    id: '7',
    url: 'https://x.com/ada/status/7',
    text: 'hello world',
    created_timestamp: 1709640000,
    author: { name: 'Ada', screen_name: 'ada' },
    ...overrides,
  },
})

describe('fetchViaFx', () => {
  it('maps an FxTwitter response to a FetchedPost', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fxJson()), { status: 200 })))
    expect(await fetchViaFx('7')).toMatchObject({ id: '7', authorHandle: 'ada', authorName: 'Ada', text: 'hello world' })
  })

  it('returns null on a non-OK response (so the caller can fall back)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 404 })))
    expect(await fetchViaFx('7')).toBeNull()
  })

  it('returns null when the tweet has no text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tweet: { id: '7', text: '' } }), { status: 200 })))
    expect(await fetchViaFx('7')).toBeNull()
  })
})

describe('fetchPost', () => {
  it('prefers FxTwitter', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL) =>
      String(u).includes('fxtwitter') ? new Response(JSON.stringify(fxJson({ id: '11' })), { status: 200 }) : new Response('{}', { status: 500 }),
    ))
    expect((await fetchPost('https://x.com/ada/status/11')).authorHandle).toBe('ada')
  })

  it('falls back to oEmbed when FxTwitter fails', async () => {
    const oembed = {
      html: '<blockquote><p>fallback text</p>&mdash; Ada (@ada) <a href="https://twitter.com/ada/status/12">Mar 5, 2026</a></blockquote>',
      author_name: 'Ada',
      author_url: 'https://twitter.com/ada',
    }
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL) =>
      String(u).includes('fxtwitter') ? new Response('{}', { status: 500 }) : new Response(JSON.stringify(oembed), { status: 200 }),
    ))
    const p = await fetchPost('https://x.com/ada/status/12')
    expect(p.text).toBe('fallback text')
    expect(p.authorHandle).toBe('ada')
  })

  it('throws InvalidPostUrlError for a non-post URL', async () => {
    await expect(fetchPost('https://example.com/whatever')).rejects.toMatchObject({ name: 'InvalidPostUrlError' })
  })
})
