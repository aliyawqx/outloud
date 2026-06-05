import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock, accountMock } = vi.hoisted(() => ({ sessionMock: vi.fn(), accountMock: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/x/store', () => ({ getAccount: accountMock }))

import { GET } from '@/app/api/x/status/route'

beforeEach(() => {
  sessionMock.mockReset(); accountMock.mockReset()
  sessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
})

describe('GET /api/x/status', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it('reports disconnected', async () => {
    accountMock.mockResolvedValue(null)
    expect(await (await GET()).json()).toEqual({ connected: false })
  })

  it('reports the connected username + scope', async () => {
    accountMock.mockResolvedValue({ userId: 'u1', xUserId: '42', username: 'ada', scope: 'tweet.read tweet.write', expiresAt: '' })
    expect(await (await GET()).json()).toEqual({ connected: true, username: 'ada', scope: 'tweet.read tweet.write' })
  })
})
