import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getSessionMock, clearCookieMock, deleteAccountMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  clearCookieMock: vi.fn(),
  deleteAccountMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({
  getSession: getSessionMock,
  clearSessionCookie: clearCookieMock,
}))
vi.mock('@/lib/auth/users', () => ({ deleteAccount: deleteAccountMock }))

import { DELETE } from '@/app/api/account/route'

beforeEach(() => {
  getSessionMock.mockReset()
  clearCookieMock.mockReset()
  deleteAccountMock.mockReset()
  getSessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
})

describe('DELETE /api/account', () => {
  it('401s when not signed in', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await DELETE()).status).toBe(401)
    expect(deleteAccountMock).not.toHaveBeenCalled()
  })

  it('deletes the account, clears the session, and returns ok', async () => {
    deleteAccountMock.mockResolvedValue(undefined)
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(deleteAccountMock).toHaveBeenCalledWith('u1')
    expect(clearCookieMock).toHaveBeenCalled()
  })

  it('500s and keeps the session when deletion fails', async () => {
    deleteAccountMock.mockRejectedValue(new Error('db down'))
    const res = await DELETE()
    expect(res.status).toBe(500)
    expect(clearCookieMock).not.toHaveBeenCalled()
  })
})
