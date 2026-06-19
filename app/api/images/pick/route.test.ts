import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getSessionMock, isStaffMock, balanceMock, deductMock, refundMock, resetMock, storeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  isStaffMock: vi.fn(),
  balanceMock: vi.fn(),
  deductMock: vi.fn(),
  refundMock: vi.fn(),
  resetMock: vi.fn(),
  storeMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: getSessionMock }))
vi.mock('@/lib/appLock', () => ({ isStaff: isStaffMock }))
vi.mock('@/lib/credits', () => ({
  getBalance: balanceMock,
  deduct: deductMock,
  refund: refundMock,
  resetIfDue: resetMock,
  InsufficientCreditsError: class InsufficientCreditsError extends Error {},
  COST_PER_PHOTO_SEARCH: 1000,
}))
vi.mock('@/lib/images/blob', () => ({ storeImageFromUrl: storeMock }))

import { POST } from '@/app/api/images/pick/route'

const photo = {
  fullUrl: 'https://images.unsplash.com/photo-1',
  downloadLocation: 'https://api.unsplash.com/photos/x/download',
  photographer: 'Ada',
  photographerUrl: 'https://unsplash.com/@ada',
}
const req = (body: unknown) =>
  new Request('http://localhost/api/images/pick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never

beforeEach(() => {
  getSessionMock.mockReset(); isStaffMock.mockReset(); balanceMock.mockReset(); deductMock.mockReset(); refundMock.mockReset(); resetMock.mockReset(); storeMock.mockReset()
  process.env.UNSPLASH_ACCESS_KEY = '' // skip the download ping in tests
  getSessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  isStaffMock.mockReturnValue(false)
  resetMock.mockResolvedValue(null)
  balanceMock.mockResolvedValue(5000)
  deductMock.mockResolvedValue({ balance: 4000, ledgerId: 'l1' })
  refundMock.mockResolvedValue(undefined)
  storeMock.mockResolvedValue({ url: 'https://blob/stock.jpg', contentType: 'image/jpeg' })
})

describe('POST /api/images/pick', () => {
  it('rejects a non-Unsplash url', async () => {
    const res = await POST(req({ ...photo, fullUrl: 'https://evil.com/x.jpg' }))
    expect(res.status).toBe(400)
    expect(deductMock).not.toHaveBeenCalled()
  })

  it('402s when credits are short, before any work', async () => {
    balanceMock.mockResolvedValue(100)
    const res = await POST(req(photo))
    expect(res.status).toBe(402)
    expect(deductMock).not.toHaveBeenCalled()
    expect(storeMock).not.toHaveBeenCalled()
  })

  it('charges on pick and returns the Blob url + attribution', async () => {
    const res = await POST(req(photo))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://blob/stock.jpg')
    expect(json.source).toBe('stock')
    expect(json.alt).toContain('Ada')
    expect(deductMock).toHaveBeenCalledWith('u1', 1000, 'photo_search', expect.any(Object))
  })

  it('refunds when copying to Blob fails after the charge', async () => {
    storeMock.mockRejectedValue(new Error('blob down'))
    const res = await POST(req(photo))
    expect(res.status).toBe(502)
    expect(refundMock).toHaveBeenCalledWith('u1', 'l1')
  })
})
