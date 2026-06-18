import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getSessionMock, isStaffMock, isPaidMock, chatMock, saveMock, getEntryMock, updateMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  isStaffMock: vi.fn(),
  isPaidMock: vi.fn(),
  chatMock: vi.fn(),
  saveMock: vi.fn(),
  getEntryMock: vi.fn(),
  updateMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: getSessionMock }))
vi.mock('@/lib/appLock', () => ({ isStaff: isStaffMock }))
vi.mock('@/lib/billing/plans', () => ({ isPaidPlan: isPaidMock }))
vi.mock('@/lib/reply/generate', () => ({ generateReplyChat: chatMock }))
vi.mock('@/lib/voice/history', () => ({
  saveComposeSession: saveMock,
  getComposeEntry: getEntryMock,
  updateComposeChat: updateMock,
}))

import { POST } from '@/app/api/reply/chat/route'

const target = { tweetId: '7', url: 'https://x.com/u/status/7', authorHandle: 'u', text: 'a claim worth replying to' }
const req = (body: unknown) =>
  new Request('http://localhost/api/reply/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never

beforeEach(() => {
  getSessionMock.mockReset(); isStaffMock.mockReset()
  isPaidMock.mockReset(); chatMock.mockReset(); saveMock.mockReset(); getEntryMock.mockReset(); updateMock.mockReset()
  getSessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  isStaffMock.mockReturnValue(true) // staff = unlimited by default
  isPaidMock.mockReturnValue(false)
  saveMock.mockResolvedValue({ id: 'h1' })
  getEntryMock.mockResolvedValue(null)
})

describe('POST /api/reply/chat', () => {
  it('401s when not signed in', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await POST(req({ target }))).status).toBe(401)
  })

  it('400s without a target post', async () => {
    expect((await POST(req({}))).status).toBe(400)
    expect(chatMock).not.toHaveBeenCalled()
  })

  it('409s with needsVoice when there is no ready voice', async () => {
    chatMock.mockResolvedValue({ needsVoice: true })
    const res = await POST(req({ target }))
    expect(res.status).toBe(409)
    expect((await res.json()).needsVoice).toBe(true)
  })

  it('writes the first reply and saves history with the target post', async () => {
    chatMock.mockResolvedValue({ needsVoice: false, draft: { fullText: 'sharp reply' }, voiceName: 'wqx', voiceProfileId: 'vp1', clarify: '' })
    const res = await POST(req({ target }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.draft.fullText).toBe('sharp reply')
    expect(json.historyId).toBe('h1')
    // generated the FIRST reply (no reviseBase yet)
    expect(chatMock).toHaveBeenCalledWith('u1', undefined, expect.objectContaining({ text: target.text }), {})
    // history saved with the post being replied to
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ replyTo: expect.objectContaining({ tweetId: '7' }) }))
  })

  it('revises the current draft when the user adds an instruction', async () => {
    chatMock.mockResolvedValue({ needsVoice: false, draft: { fullText: 'tighter reply' }, voiceName: 'wqx', voiceProfileId: 'vp1', clarify: '' })
    getEntryMock.mockResolvedValue({ id: 'h1' }) // the session already exists → update in place
    const turns = [
      { role: 'assistant', draft: { fullText: 'first reply' } },
      { role: 'user', text: 'make it shorter' },
    ]
    const res = await POST(req({ target, turns, historyId: 'h1' }))
    expect(res.status).toBe(200)
    expect(chatMock).toHaveBeenCalledWith('u1', undefined, expect.any(Object), { reviseBase: 'first reply', instruction: 'make it shorter' })
    expect(updateMock).toHaveBeenCalled() // updates the existing history entry in place
  })
})
