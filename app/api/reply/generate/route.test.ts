import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getSessionMock, isStaffMock, genMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  isStaffMock: vi.fn(),
  genMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: getSessionMock }))
vi.mock('@/lib/appLock', () => ({ isStaff: isStaffMock }))
vi.mock('@/lib/reply/generate', () => ({ generateReplyVariants: genMock }))
vi.mock('@/lib/voice/generate', () => ({ VoiceNotReadyError: class VoiceNotReadyError extends Error {} }))

import { POST } from '@/app/api/reply/generate/route'

const goodPost = { id: '7', text: 'a claim worth replying to', authorHandle: 'u' }
const req = (body: unknown) =>
  new Request('http://localhost/api/reply/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never

beforeEach(() => {
  getSessionMock.mockReset(); isStaffMock.mockReset(); genMock.mockReset()
  getSessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  isStaffMock.mockReturnValue(true) // staff = unlimited (skips credit metering)
})

describe('POST /api/reply/generate', () => {
  it('401s when not signed in', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await POST(req({ post: goodPost }))).status).toBe(401)
  })

  it('400s without a post', async () => {
    expect((await POST(req({}))).status).toBe(400)
    expect(genMock).not.toHaveBeenCalled()
  })

  it('409s with needsVoice when there is no ready voice', async () => {
    genMock.mockResolvedValue({ needsVoice: true })
    const res = await POST(req({ post: goodPost }))
    expect(res.status).toBe(409)
    expect((await res.json()).needsVoice).toBe(true)
  })

  it('returns variants + the tweet id on success', async () => {
    genMock.mockResolvedValue({ needsVoice: false, variants: [{ fullText: 'sharp reply' }], voiceName: 'wqx', clarify: '' })
    const res = await POST(req({ post: goodPost, angle: 'point out X', angleType: 'sharp take' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.variants).toEqual(['sharp reply'])
    expect(json.tweetId).toBe('7')
  })
})
