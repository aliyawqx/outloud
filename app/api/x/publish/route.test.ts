import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock, tokenMock, postMock, accountMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  tokenMock: vi.fn(),
  postMock: vi.fn(),
  accountMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/x/store', () => ({ getValidAccessToken: tokenMock, getAccount: accountMock }))
vi.mock('@/lib/x/client', () => ({ postTweet: postMock }))

import { POST } from '@/app/api/x/publish/route'
import { XNotConnectedError } from '@/lib/x/errors'

const json = (b: unknown) =>
  new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  sessionMock.mockReset(); tokenMock.mockReset(); postMock.mockReset(); accountMock.mockReset()
  sessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  tokenMock.mockResolvedValue('tok')
  postMock.mockResolvedValue({ id: '999' })
  accountMock.mockResolvedValue({ userId: 'u1', xUserId: '42', username: 'ada', scope: '', expiresAt: '' })
})

describe('POST /api/x/publish', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await POST(json({ text: 'hi' }))).status).toBe(401)
  })

  it('400 on empty text', async () => {
    expect((await POST(json({ text: '   ' }))).status).toBe(400)
    expect(postMock).not.toHaveBeenCalled()
  })

  it('publishes and returns the tweet url', async () => {
    const res = await POST(json({ text: 'shipped dark mode' }))
    expect(res.status).toBe(200)
    expect(postMock).toHaveBeenCalledWith('tok', 'shipped dark mode')
    expect((await res.json()).url).toBe('https://x.com/ada/status/999')
  })

  it('409 when not connected', async () => {
    tokenMock.mockRejectedValue(new XNotConnectedError())
    expect((await POST(json({ text: 'hi' }))).status).toBe(409)
  })
})
