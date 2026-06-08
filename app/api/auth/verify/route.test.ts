import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getSessionMock, verifyCodeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  verifyCodeMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: getSessionMock }))
vi.mock('@/lib/auth/verify', () => ({ verifyCode: verifyCodeMock }))

import { POST } from '@/app/api/auth/verify/route'

function req(body: unknown) {
  return new Request('http://localhost/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  getSessionMock.mockReset()
  verifyCodeMock.mockReset()
  getSessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
})

describe('POST /api/auth/verify', () => {
  it('401s when not signed in', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await POST(req({ code: '123456' }))).status).toBe(401)
    expect(verifyCodeMock).not.toHaveBeenCalled()
  })

  it('400s on a non-6-digit code without calling the checker', async () => {
    expect((await POST(req({ code: '12' }))).status).toBe(400)
    expect((await POST(req({ code: 'abcdef' }))).status).toBe(400)
    expect(verifyCodeMock).not.toHaveBeenCalled()
  })

  it('200s on a correct code', async () => {
    verifyCodeMock.mockResolvedValue('ok')
    const res = await POST(req({ code: '123456' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(verifyCodeMock).toHaveBeenCalledWith('u1', '123456')
  })

  it('200s when already verified (idempotent)', async () => {
    verifyCodeMock.mockResolvedValue('already')
    expect((await POST(req({ code: '123456' }))).status).toBe(200)
  })

  it('400s with an expiry message when the code is expired', async () => {
    verifyCodeMock.mockResolvedValue('expired')
    const res = await POST(req({ code: '123456' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/expired/i)
  })

  it('400s on an invalid code', async () => {
    verifyCodeMock.mockResolvedValue('invalid')
    const res = await POST(req({ code: '000000' }))
    expect(res.status).toBe(400)
  })
})
