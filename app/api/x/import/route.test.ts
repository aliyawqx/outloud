import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock, tokenMock, accountMock, fetchTweetsMock, timelineMock, getProfileMock, addSamplesMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  tokenMock: vi.fn(),
  accountMock: vi.fn(),
  fetchTweetsMock: vi.fn(),
  timelineMock: vi.fn(),
  getProfileMock: vi.fn(),
  addSamplesMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/x/store', () => ({ getValidAccessToken: tokenMock, getAccount: accountMock }))
vi.mock('@/lib/x/client', () => ({ fetchOriginalTweets: fetchTweetsMock }))
vi.mock('@/lib/x/timeline', () => ({ fetchTimelineViaWorker: timelineMock }))
vi.mock('@/lib/voice/store', () => ({ getProfile: getProfileMock }))
vi.mock('@/lib/voice/samples', () => ({ addSamples: addSamplesMock }))

import { POST } from '@/app/api/x/import/route'
import { ImportNotAvailableError, SearchUnavailableError } from '@/lib/x/errors'

const json = (b: unknown) =>
  new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  sessionMock.mockReset(); tokenMock.mockReset(); accountMock.mockReset(); fetchTweetsMock.mockReset(); timelineMock.mockReset(); getProfileMock.mockReset(); addSamplesMock.mockReset()
  delete process.env.X_IMPORT_PROVIDER
  sessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  getProfileMock.mockResolvedValue({ id: 'p1' })
  accountMock.mockResolvedValue({ userId: 'u1', xUserId: '42', username: 'ada', scope: '', expiresAt: '' })
  tokenMock.mockResolvedValue('tok')
  fetchTweetsMock.mockResolvedValue(['post one', 'post two'])
  timelineMock.mockResolvedValue(['nitter one', 'nitter two', 'nitter three'])
  addSamplesMock.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
})

describe('POST /api/x/import', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await POST(json({ profileId: 'p1' }))).status).toBe(401)
  })

  it('404 when the profile is not the user’s', async () => {
    getProfileMock.mockResolvedValue(null)
    expect((await POST(json({ profileId: 'p1' }))).status).toBe(404)
  })

  it('409 when no X account connected', async () => {
    accountMock.mockResolvedValue(null)
    expect((await POST(json({ profileId: 'p1' }))).status).toBe(409)
    expect(fetchTweetsMock).not.toHaveBeenCalled()
  })

  it('imports posts as x samples', async () => {
    const res = await POST(json({ profileId: 'p1' }))
    expect(res.status).toBe(200)
    expect(fetchTweetsMock).toHaveBeenCalledWith('tok', '42', 20)
    expect(addSamplesMock).toHaveBeenCalledWith('u1', 'p1', [
      { source: 'x', text: 'post one' },
      { source: 'x', text: 'post two' },
    ])
    expect((await res.json()).added).toBe(2)
  })

  it('409 with the tier message when import is gated', async () => {
    fetchTweetsMock.mockRejectedValue(new ImportNotAvailableError())
    const res = await POST(json({ profileId: 'p1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/isn't available right now/)
  })

  describe('nitter provider', () => {
    beforeEach(() => { process.env.X_IMPORT_PROVIDER = 'nitter' })

    it('imports via the worker by the connected @handle (no X API call)', async () => {
      const res = await POST(json({ profileId: 'p1' }))
      expect(res.status).toBe(200)
      expect(timelineMock).toHaveBeenCalledWith('ada', 20)
      expect(fetchTweetsMock).not.toHaveBeenCalled()
      expect((await res.json()).added).toBe(2)
    })

    it('uses a body @handle and works with no connected account', async () => {
      accountMock.mockResolvedValue(null)
      const res = await POST(json({ profileId: 'p1', handle: '@someone' }))
      expect(res.status).toBe(200)
      expect(timelineMock).toHaveBeenCalledWith('someone', 20)
    })

    it('400 needsHandle when no handle and no account', async () => {
      accountMock.mockResolvedValue(null)
      const res = await POST(json({ profileId: 'p1' }))
      expect(res.status).toBe(400)
      expect((await res.json()).needsHandle).toBe(true)
    })

    it('409 importUnavailable when the worker is unreachable', async () => {
      timelineMock.mockRejectedValue(new SearchUnavailableError())
      const res = await POST(json({ profileId: 'p1' }))
      expect(res.status).toBe(409)
      expect((await res.json()).importUnavailable).toBe(true)
    })
  })
})
