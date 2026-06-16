import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchThreadsPosts } from './search'

afterEach(() => vi.unstubAllGlobals())

describe('searchThreadsPosts', () => {
  it('builds the keyword_search URL and maps results, dropping empty-text hits', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) =>
      new Response(
        JSON.stringify({
          data: [
            { id: '1', text: ' hello ', permalink: 'https://www.threads.net/t/1', username: 'ada', timestamp: '2026-06-16T00:00:00Z', has_replies: true },
            { id: '2', text: '   ', permalink: 'x', username: 'b' },
            { id: '3', text: 'second', permalink: 'https://www.threads.net/t/3', username: 'lin' },
          ],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const out = await searchThreadsPosts('tok', 'ai agents')
    expect(out).toEqual([
      { id: '1', text: 'hello', permalink: 'https://www.threads.net/t/1', username: 'ada', timestamp: '2026-06-16T00:00:00Z', hasReplies: true },
      { id: '3', text: 'second', permalink: 'https://www.threads.net/t/3', username: 'lin', timestamp: '', hasReplies: false },
    ])

    const u = new URL(String(fetchMock.mock.calls[0][0]))
    expect(u.origin + u.pathname).toBe('https://graph.threads.net/v1.0/keyword_search')
    expect(u.searchParams.get('q')).toBe('ai agents')
    expect(u.searchParams.get('search_type')).toBe('TOP')
    expect(u.searchParams.get('fields')).toBe('id,text,permalink,username,timestamp,has_replies')
    expect(u.searchParams.get('access_token')).toBe('tok')
    expect(u.searchParams.get('author_username')).toBeNull()
  })

  it('passes author_username (stripping a leading @) when provided', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => new Response(JSON.stringify({ data: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await searchThreadsPosts('tok', 'ai', { authorUsername: '@levelsio' })
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('author_username')).toBe('levelsio')
  })

  it('throws ThreadsSearchRateLimitError on 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })))
    await expect(searchThreadsPosts('tok', 'ai')).rejects.toMatchObject({ name: 'ThreadsSearchRateLimitError' })
  })

  it('treats a 4xx with a rate-limit error code softly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 4, message: 'Application request limit reached' } }), { status: 400 })))
    await expect(searchThreadsPosts('tok', 'ai')).rejects.toMatchObject({ name: 'ThreadsSearchRateLimitError' })
  })

  it('throws ThreadsSearchUnavailableError on other failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 100, message: 'bad' } }), { status: 400 })))
    await expect(searchThreadsPosts('tok', 'ai')).rejects.toMatchObject({ name: 'ThreadsSearchUnavailableError' })
  })

  it('returns [] for a blank keyword without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchThreadsPosts('tok', '   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
