import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getSessionMock, isStaffMock, balanceMock, deductMock, resetMock, falMock, storeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  isStaffMock: vi.fn(),
  balanceMock: vi.fn(),
  deductMock: vi.fn(),
  resetMock: vi.fn(),
  falMock: vi.fn(),
  storeMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: getSessionMock }))
vi.mock('@/lib/appLock', () => ({ isStaff: isStaffMock }))
vi.mock('@/lib/credits', () => ({
  getBalance: balanceMock,
  deduct: deductMock,
  resetIfDue: resetMock,
  COST_PER_AI_PHOTO: 2000,
}))
vi.mock('@/lib/images/blob', () => ({ storeImageFromUrl: storeMock }))
vi.mock('@fal-ai/client', () => ({ fal: { config: vi.fn(), subscribe: falMock } }))

import { POST } from '@/app/api/images/generate/route'

const req = (body: unknown) =>
  new Request('http://localhost/api/images/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never

beforeEach(() => {
  getSessionMock.mockReset(); isStaffMock.mockReset(); balanceMock.mockReset(); deductMock.mockReset(); resetMock.mockReset(); falMock.mockReset(); storeMock.mockReset()
  process.env.FAL_KEY = 'test-key'
  getSessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  isStaffMock.mockReturnValue(false)
  resetMock.mockResolvedValue(null)
  balanceMock.mockResolvedValue(5000)
  falMock.mockResolvedValue({ data: { images: [{ url: 'https://fal/out.png' }] } })
  storeMock.mockResolvedValue({ url: 'https://blob/img.png', contentType: 'image/png' })
  deductMock.mockResolvedValue({ balance: 3000, ledgerId: 'l1' })
})

describe('POST /api/images/generate', () => {
  it('402s and never calls fal or deduct when credits are short', async () => {
    balanceMock.mockResolvedValue(100) // < 2000
    const res = await POST(req({ prompt: 'a cat' }))
    expect(res.status).toBe(402)
    expect((await res.json()).insufficientCredits).toBe(true)
    expect(falMock).not.toHaveBeenCalled()
    expect(deductMock).not.toHaveBeenCalled()
  })

  it('generates, stores in Blob, then deducts on success', async () => {
    const res = await POST(req({ prompt: 'a cat on a skateboard' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://blob/img.png')
    expect(json.source).toBe('ai')
    expect(storeMock).toHaveBeenCalled()
    expect(deductMock).toHaveBeenCalledWith('u1', 2000, 'ai_image', expect.any(Object))
  })

  it('does NOT charge when generation fails', async () => {
    falMock.mockRejectedValue(new Error('fal down'))
    const res = await POST(req({ prompt: 'a cat' }))
    expect(res.status).toBe(502)
    expect(deductMock).not.toHaveBeenCalled()
  })

  it('staff skip the credit check and the charge', async () => {
    isStaffMock.mockReturnValue(true)
    const res = await POST(req({ prompt: 'a cat' }))
    expect(res.status).toBe(200)
    expect(balanceMock).not.toHaveBeenCalled()
    expect(deductMock).not.toHaveBeenCalled()
  })
})
