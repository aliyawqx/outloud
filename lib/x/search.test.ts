import { afterEach, describe, expect, it, vi } from 'vitest'

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }))
vi.mock('@/lib/anthropic', () => ({ findTweetUrlsViaWeb: llmMock }))

import { searchPosts, computeReachScore } from './search'

const NOW = 1709640000000
const hourAgo = new Date(NOW - 3600_000).toISOString()
const tsSec = Math.floor((NOW - 3600_000) / 1000)

afterEach(() => {
  vi.unstubAllGlobals()
  llmMock.mockReset()
  delete process.env.X_SEARCH_WORKER_URL
  delete process.env.X_SEARCH_WORKER_TOKEN
  delete process.env.X_SEARCH_PROVIDER
})

describe('computeReachScore', () => {
  it('rewards big accounts and engagement', () => {
    const big = computeReachScore({ followers: 200_000, likes: 5000, replies: 10, reposts: 50, quotes: 5 })
    const small = computeReachScore({ followers: 500, likes: 50, replies: 1, reposts: 0, quotes: 0 })
    expect(big).toBeGreaterThan(small)
  })
})

describe('searchPosts via the worker provider', () => {
  it('maps + ranks worker posts and drops ones below the like floor', async () => {
    process.env.X_SEARCH_WORKER_URL = 'https://worker.example'
    const posts = [
      { id: '1', authorHandle: 'big', followers: 200_000, text: 'a strong take', createdAt: hourAgo, likes: 5000, replies: 10, reposts: 20, quotes: 5 },
      { id: '2', authorHandle: 'tiny', followers: 100, text: 'noise', createdAt: hourAgo, likes: 5 },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ posts }), { status: 200 })))
    const res = await searchPosts('tok', 'workertopic-strong', { now: NOW })
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('1')
    expect(res[0].reachScore).toBeGreaterThan(0)
    expect(res[0].url).toBe('https://x.com/big/status/1')
  })

  it('relaxes to the fallback floor when nothing clears the high bar', async () => {
    process.env.X_SEARCH_WORKER_URL = 'https://worker.example'
    const posts = [{ id: '3', authorHandle: 'mid', followers: 5000, text: 'decent', createdAt: hourAgo, likes: 300 }]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ posts }), { status: 200 })))
    const res = await searchPosts('tok', 'workertopic-fallback', { now: NOW })
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('3')
  })

  it('surfaces a worker failure as SearchUnavailableError', async () => {
    process.env.X_SEARCH_WORKER_URL = 'https://worker.example'
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 502 })))
    await expect(searchPosts('tok', 'workertopic-down', { now: NOW })).rejects.toMatchObject({ name: 'SearchUnavailableError' })
  })
})

describe('searchPosts via the LLM provider', () => {
  it('verifies LLM-found tweets through FxTwitter and keeps only real, on-bar posts', async () => {
    process.env.X_SEARCH_PROVIDER = 'llm'
    llmMock.mockResolvedValue(['https://x.com/big/status/1', 'https://x.com/tiny/status/2'])
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL) => {
      const id = String(u).match(/status\/(\d+)/)?.[1]
      if (id === '1')
        return new Response(JSON.stringify({ tweet: { id: '1', url: 'https://x.com/big/status/1', text: 'a strong take', created_timestamp: tsSec, likes: 5000, retweets: 20, replies: 10, author: { name: 'Big', screen_name: 'big', followers: 200000 } } }), { status: 200 })
      return new Response(JSON.stringify({ tweet: { id: '2', text: 'noise', created_timestamp: tsSec, likes: 5, author: { screen_name: 'tiny' } } }), { status: 200 })
    }))
    const res = await searchPosts('tok', 'llmtopic-strong', { now: NOW })
    expect(res).toHaveLength(1) // the 5-like one is filtered out
    expect(res[0].id).toBe('1')
    expect(res[0].followers).toBe(200000)
    expect(res[0].url).toBe('https://x.com/big/status/1')
  })

  it('returns [] when the model finds no usable tweet URLs', async () => {
    process.env.X_SEARCH_PROVIDER = 'llm'
    llmMock.mockResolvedValue([])
    const res = await searchPosts('tok', 'llmtopic-empty', { now: NOW })
    expect(res).toEqual([])
  })
})
