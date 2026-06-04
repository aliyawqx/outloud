import { vi, describe, it, expect, beforeEach } from 'vitest'

const { verifyMock } = vi.hoisted(() => ({ verifyMock: vi.fn() }))
vi.mock('@/lib/auth/jwt', () => ({ SESSION_COOKIE: 'outloud_session', verifySessionToken: verifyMock }))

import { middleware } from '@/middleware'
import { NextRequest } from 'next/server'

beforeEach(() => verifyMock.mockReset())

describe('auth middleware', () => {
  it('redirects logged-out users to sign-up, preserving the destination', async () => {
    verifyMock.mockResolvedValue(null)
    const res = await middleware(new NextRequest('http://localhost/app/voices'))
    expect(res.status).toBe(307)
    const loc = res.headers.get('location') ?? ''
    expect(loc).toContain('/signup')
    expect(loc).toContain('next=%2Fapp%2Fvoices')
  })

  it('lets signed-in users through', async () => {
    verifyMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
    const res = await middleware(new NextRequest('http://localhost/app'))
    expect(res.headers.get('location')).toBeNull()
  })
})
