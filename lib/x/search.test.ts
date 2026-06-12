import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchPosts, computeReachScore } from './search'

const NOW = 1709640000000
const hourAgo = new Date(NOW - 3600_000).toISOString()

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.X_SEARCH_WORKER_URL
  delete process.env.X_SEARCH_WORKER_TOKEN
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
