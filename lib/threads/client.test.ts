import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMe, getPermalink, publishThread, THREADS_TEXT_LIMIT } from './client'

afterEach(() => vi.unstubAllGlobals())

const noSleep = async () => {}

describe('getMe', () => {
  it('returns id + username', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: '42', username: 'ada' }), { status: 200 })))
    expect(await getMe('tok')).toEqual({ id: '42', username: 'ada' })
  })

  it('falls back to id when no username is exposed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: '42' }), { status: 200 })))
    expect(await getMe('tok')).toEqual({ id: '42', username: '42' })
  })

  it('throws ThreadsAuthError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(getMe('tok')).rejects.toMatchObject({ name: 'ThreadsAuthError' })
  })
})

describe('publishThread', () => {
  it('creates a TEXT container then publishes it, returning the media id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-9' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await publishThread('tok', '777', 'hello threads')).toEqual({ id: 'media-9' })

    const [createUrl, createInit] = fetchMock.mock.calls[0]
    expect(String(createUrl)).toBe('https://graph.threads.net/v1.0/777/threads')
    const createBody = new URLSearchParams(createInit.body as string)
    expect(createBody.get('media_type')).toBe('TEXT')
    expect(createBody.get('text')).toBe('hello threads')
    expect(createBody.get('access_token')).toBe('tok')
    expect(createBody.get('reply_to_id')).toBeNull()

    const [publishUrl, publishInit] = fetchMock.mock.calls[1]
    expect(String(publishUrl)).toBe('https://graph.threads.net/v1.0/777/threads_publish')
    expect(new URLSearchParams(publishInit.body as string).get('creation_id')).toBe('container-1')
  })

  it('passes reply_to_id when publishing a reply', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'm1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await publishThread('tok', '777', 'agreed', { replyToId: '123' })
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body as string).get('reply_to_id')).toBe('123')
  })

  it('throws ThreadsPostTooLongError before calling the API when over the limit', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(publishThread('tok', '777', 'a'.repeat(THREADS_TEXT_LIMIT + 1))).rejects.toMatchObject({
      name: 'ThreadsPostTooLongError',
      limit: 500,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('backs off and retries on 429, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'rate' } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'm1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await publishThread('tok', '777', 'hi', { sleep: noSleep })).toEqual({ id: 'm1' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws ThreadsRateLimitError after exhausting retries on 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'rate' } }), { status: 429 })))
    await expect(publishThread('tok', '777', 'hi', { sleep: noSleep, maxAttempts: 3 })).rejects.toMatchObject({
      name: 'ThreadsRateLimitError',
    })
  })

  it('throws ThreadsAuthError on 401 without retrying', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(publishThread('tok', '777', 'hi', { sleep: noSleep })).rejects.toMatchObject({ name: 'ThreadsAuthError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('getPermalink', () => {
  it('returns the permalink when available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ permalink: 'https://www.threads.net/t/abc' }), { status: 200 })))
    expect(await getPermalink('tok', 'm1')).toBe('https://www.threads.net/t/abc')
  })

  it('returns null on failure instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    expect(await getPermalink('tok', 'm1')).toBeNull()
  })
})
