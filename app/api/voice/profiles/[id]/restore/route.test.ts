import { vi, describe, it, expect, beforeEach } from 'vitest'

const { restoreMock, sessionMock } = vi.hoisted(() => ({
  restoreMock: vi.fn(),
  sessionMock: vi.fn(),
}))
vi.mock('@/lib/voice/store', () => ({ restoreProfile: restoreMock }))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))

import { POST } from '@/app/api/voice/profiles/[id]/restore/route'

const OWNER = 'user-abc123'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = () =>
  new Request('http://localhost/api/voice/profiles/p1/restore', { method: 'POST' }) as never

beforeEach(() => {
  restoreMock.mockReset()
  sessionMock.mockReset()
  sessionMock.mockResolvedValue({ userId: OWNER, email: 'a@b.com' })
})

describe('POST /api/voice/profiles/:id/restore', () => {
  it('restores the owner’s soft-deleted profile', async () => {
    const profile = { id: 'p1', name: 'My voice' }
    restoreMock.mockResolvedValue(profile)
    const res = await POST(req(), ctx('p1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ profile })
    expect(restoreMock).toHaveBeenCalledWith(OWNER, 'p1')
  })

  it('404s when there is nothing to restore', async () => {
    restoreMock.mockResolvedValue(null)
    const res = await POST(req(), ctx('p1'))
    expect(res.status).toBe(404)
  })

  it('401s when signed out', async () => {
    sessionMock.mockResolvedValue(null)
    const res = await POST(req(), ctx('p1'))
    expect(res.status).toBe(401)
    expect(restoreMock).not.toHaveBeenCalled()
  })
})
