import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getUserMock, verifyMock, setCookieMock, tokenMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  verifyMock: vi.fn(),
  setCookieMock: vi.fn(),
  tokenMock: vi.fn(),
}))
vi.mock('@/lib/auth/users', () => ({ getUserByEmail: getUserMock }))
vi.mock('@/lib/auth/password', () => ({ verifyPassword: verifyMock }))
vi.mock('@/lib/auth/session', () => ({ createSessionToken: tokenMock, setSessionCookie: setCookieMock }))

import { POST } from '@/app/api/auth/login/route'

function req(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  getUserMock.mockReset()
  verifyMock.mockReset()
  setCookieMock.mockReset()
  tokenMock.mockReset()
  tokenMock.mockResolvedValue('signed.jwt')
})

describe('POST /api/auth/login', () => {
  it('signs in with valid credentials and redirects home', async () => {
    getUserMock.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: 'h' })
    verifyMock.mockResolvedValue(true)
    const res = await POST(req({ email: 'a@b.com', password: 'supersecret' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, redirect: '/app' })
    expect(setCookieMock).toHaveBeenCalledWith('signed.jwt')
  })

  it('401s on a wrong password (generic message)', async () => {
    getUserMock.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: 'h' })
    verifyMock.mockResolvedValue(false)
    const res = await POST(req({ email: 'a@b.com', password: 'wrongpass' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid email or password.')
    expect(setCookieMock).not.toHaveBeenCalled()
  })

  it('401s on an unknown email without leaking that it is unknown', async () => {
    getUserMock.mockResolvedValue(null)
    const res = await POST(req({ email: 'ghost@b.com', password: 'supersecret' }))
    expect(res.status).toBe(401)
    expect(verifyMock).not.toHaveBeenCalled()
  })

  it('400s on invalid input', async () => {
    expect((await POST(req({ email: 'bad' }))).status).toBe(400)
  })
})
