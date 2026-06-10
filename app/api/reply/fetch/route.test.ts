import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getSessionMock, fetchPostMock } = vi.hoisted(() => ({ getSessionMock: vi.fn(), fetchPostMock: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: getSessionMock }))
vi.mock('@/lib/x/fetchPost', () => ({ fetchPost: fetchPostMock }))

import { POST } from '@/app/api/reply/fetch/route'
import { InvalidPostUrlError, PostUnavailableError } from '@/lib/x/errors'

const req = (body: unknown) =>
  new Request('http://localhost/api/reply/fetch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never

beforeEach(() => {
  getSessionMock.mockReset()
  fetchPostMock.mockReset()
  getSessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
})

describe('POST /api/reply/fetch', () => {
  it('401s when not signed in', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await POST(req({ url: 'https://x.com/u/status/1' }))).status).toBe(401)
  })

  it('400s on a missing url', async () => {
    expect((await POST(req({}))).status).toBe(400)
    expect(fetchPostMock).not.toHaveBeenCalled()
  })

  it('returns the fetched post', async () => {
    fetchPostMock.mockResolvedValue({ id: '1', text: 'hi', authorHandle: 'u' })
    const res = await POST(req({ url: 'https://x.com/u/status/1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).post).toMatchObject({ id: '1', authorHandle: 'u' })
  })

  it('400s on an invalid url, 404 on an unavailable post', async () => {
    fetchPostMock.mockRejectedValue(new InvalidPostUrlError())
    expect((await POST(req({ url: 'nope' }))).status).toBe(400)
    fetchPostMock.mockRejectedValue(new PostUnavailableError())
    expect((await POST(req({ url: 'https://x.com/u/status/1' }))).status).toBe(404)
  })
})
