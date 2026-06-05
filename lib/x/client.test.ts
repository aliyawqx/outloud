import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOriginalTweets, getMe, postTweet } from './client'

afterEach(() => vi.unstubAllGlobals())

describe('getMe', () => {
  it('returns id + username', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { id: '42', username: 'ada' } }), { status: 200 })))
    expect(await getMe('tok')).toEqual({ id: '42', username: 'ada' })
  })

  it('throws XAuthError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(getMe('tok')).rejects.toThrow(/X authorization/)
  })
})

describe('postTweet', () => {
  it('posts text and returns the new tweet id', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init: RequestInit) =>
      new Response(JSON.stringify({ data: { id: '999', text: 'hi' } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await postTweet('tok', 'hi')).toEqual({ id: '999' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.x.com/2/tweets')
    expect(JSON.parse(init.body as string)).toEqual({ text: 'hi' })
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('throws PublishError with X detail on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Text too long.' }), { status: 403 })))
    await expect(postTweet('tok', 'x')).rejects.toThrow('Text too long.')
  })
})

describe('fetchOriginalTweets', () => {
  it('returns trimmed non-empty texts, preferring note_tweet long text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [
        { id: '1', text: ' short ' },
        { id: '2', text: 'truncated…', note_tweet: { text: 'the full long post' } },
        { id: '3', text: '   ' },
      ],
    }), { status: 200 })))
    expect(await fetchOriginalTweets('tok', '42', 20)).toEqual(['short', 'the full long post'])
  })

  it('throws ImportNotAvailableError on 403 (tier gate)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })))
    await expect(fetchOriginalTweets('tok', '42', 20)).rejects.toThrow(/isn't available right now/)
  })

  it('returns [] when the user has no posts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ meta: { result_count: 0 } }), { status: 200 })))
    expect(await fetchOriginalTweets('tok', '42', 20)).toEqual([])
  })
})
