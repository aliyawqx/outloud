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

  it('posts a reply with the in_reply_to field when given a target tweet', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init: RequestInit) =>
      new Response(JSON.stringify({ data: { id: '999' } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await postTweet('tok', 'agreed', '123')
    const init = fetchMock.mock.calls[0][1]
    expect(JSON.parse(init.body as string)).toEqual({ text: 'agreed', reply: { in_reply_to_tweet_id: '123' } })
  })

  it('throws ReplyNotAllowedError when the author restricted replies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ detail: 'Reply to this conversation is not allowed because you have not been mentioned or otherwise engaged by the author of the post you are replying to.' }),
      { status: 403 })))
    await expect(postTweet('tok', 'nice point', '123')).rejects.toMatchObject({ name: 'ReplyNotAllowedError' })
  })

  it('throws PublishError with X detail on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Text too long.' }), { status: 403 })))
    await expect(postTweet('tok', 'x')).rejects.toThrow('Text too long.')
  })

  it('throws PostTooLongError when a non-premium account is rejected for an over-limit post', async () => {
    const long = 'a'.repeat(300)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'not permitted' }), { status: 403 })))
    await expect(postTweet('tok', long)).rejects.toMatchObject({ name: 'PostTooLongError', limit: 280 })
  })

  it('does NOT treat an under-limit failure as too-long', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'rate limit' }), { status: 429 })))
    await expect(postTweet('tok', 'short post')).rejects.toMatchObject({ name: 'PublishError' })
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
