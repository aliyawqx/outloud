import { vi, describe, it, expect, beforeEach } from 'vitest'

const { createUserMock, setCookieMock, tokenMock, setVerifyCodeMock, sendCodeMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  setCookieMock: vi.fn(),
  tokenMock: vi.fn(),
  setVerifyCodeMock: vi.fn(),
  sendCodeMock: vi.fn(),
}))
vi.mock('@/lib/auth/users', () => ({
  createUser: createUserMock,
  EmailTakenError: class EmailTakenError extends Error {},
}))
vi.mock('@/lib/auth/session', () => ({
  createSessionToken: tokenMock,
  setSessionCookie: setCookieMock,
}))
vi.mock('@/lib/auth/verify', () => ({ setVerifyCode: setVerifyCodeMock }))
vi.mock('@/lib/auth/email', () => ({ sendVerificationCode: sendCodeMock }))

import { POST } from '@/app/api/auth/signup/route'
import { EmailTakenError } from '@/lib/auth/users'

function req(body: unknown) {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  createUserMock.mockReset()
  setCookieMock.mockReset()
  tokenMock.mockReset()
  setVerifyCodeMock.mockReset()
  sendCodeMock.mockReset()
  tokenMock.mockResolvedValue('signed.jwt')
  setVerifyCodeMock.mockResolvedValue('123456')
  sendCodeMock.mockResolvedValue(undefined)
})

describe('POST /api/auth/signup', () => {
  it('creates the account, sets a session, and redirects to voices onboarding', async () => {
    createUserMock.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
    const res = await POST(req({ email: 'A@B.com', password: 'supersecret', displayName: 'Aya' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual({ ok: true, redirect: '/app/onboarding' })

    expect(createUserMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'supersecret', displayName: 'Aya' })
    expect(setCookieMock).toHaveBeenCalledWith('signed.jwt')
    // A verification code is issued and emailed on signup.
    expect(setVerifyCodeMock).toHaveBeenCalledWith('u1')
    expect(sendCodeMock).toHaveBeenCalledWith('a@b.com', '123456')
  })

  it('still succeeds (201) when sending the verification code fails', async () => {
    createUserMock.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
    sendCodeMock.mockRejectedValue(new Error('resend down'))
    const res = await POST(req({ email: 'a@b.com', password: 'supersecret', displayName: 'Aya' }))
    expect(res.status).toBe(201)
    expect(setCookieMock).toHaveBeenCalledWith('signed.jwt')
  })

  it('400s on a bad email / short password', async () => {
    expect((await POST(req({ email: 'nope', password: 'supersecret' }))).status).toBe(400)
    expect((await POST(req({ email: 'a@b.com', password: 'short' }))).status).toBe(400)
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it('409s when the email is already registered', async () => {
    createUserMock.mockRejectedValue(new EmailTakenError())
    const res = await POST(req({ email: 'a@b.com', password: 'supersecret' }))
    expect(res.status).toBe(409)
    expect(setCookieMock).not.toHaveBeenCalled()
  })
})
