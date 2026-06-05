import { vi, describe, it, expect, beforeEach } from 'vitest'

const { sessionMock, getProfileMock, listProfilesMock, enabledMock, genMock, saveMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  getProfileMock: vi.fn(),
  listProfilesMock: vi.fn(),
  enabledMock: vi.fn(),
  genMock: vi.fn(),
  saveMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/voice/store', () => ({ getProfile: getProfileMock, listProfiles: listProfilesMock }))
vi.mock('@/lib/voice/samples', () => ({ listEnabledTexts: enabledMock }))
vi.mock('@/lib/voice/generate', () => ({
  generatePost: genMock,
  VoiceNotReadyError: class VoiceNotReadyError extends Error {},
}))
vi.mock('@/lib/voice/history', () => ({ saveComposeSession: saveMock }))

import { POST } from '@/app/api/voice/compose/route'

const OWNER = 'user-1'
const drafts = [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'post one' }]
const req = (b: unknown) =>
  new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }) as never

beforeEach(() => {
  sessionMock.mockReset(); getProfileMock.mockReset(); listProfilesMock.mockReset()
  enabledMock.mockReset(); genMock.mockReset(); saveMock.mockReset()
  sessionMock.mockResolvedValue({ userId: OWNER, email: 'a@b.com' })
  listProfilesMock.mockResolvedValue([{ id: 'p1', name: 'My voice', isActive: true }])
  enabledMock.mockResolvedValue(['anchor sample'])
  genMock.mockResolvedValue({ drafts, clarify: '' })
  saveMock.mockResolvedValue({ id: 'h1' })
})

describe('POST /api/voice/compose', () => {
  it('401 without a session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await POST(req({ idea: 'x' }))).status).toBe(401)
  })

  it('400 without an idea', async () => {
    expect((await POST(req({}))).status).toBe(400)
    expect(genMock).not.toHaveBeenCalled()
  })

  it('generates drafts and SAVES the session to history', async () => {
    const res = await POST(req({ idea: 'shipped billing' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.drafts).toEqual(drafts)
    expect(json.historyId).toBe('h1')

    expect(saveMock).toHaveBeenCalledWith({
      ownerKey: OWNER,
      voiceProfileId: 'p1',
      voiceName: 'My voice',
      idea: 'shipped billing',
      drafts,
    })
  })

  it('returns a clarify ask (no draft, no history save) when the idea is unclear', async () => {
    genMock.mockResolvedValue({ drafts: [], clarify: 'tell me more about what you shipped' })
    const res = await POST(req({ idea: 'asdf' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.clarify).toContain('tell me more')
    expect(json.drafts).toBeUndefined()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('still returns drafts if the history save fails', async () => {
    saveMock.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ idea: 'x' }))
    expect(res.status).toBe(200)
    expect((await res.json()).drafts).toEqual(drafts)
  })

  it('does NOT inject day/follower by default, but does when challenge:true', async () => {
    await POST(req({ idea: 'x' }))
    expect(genMock.mock.calls[0][0].dayNumber).toBeUndefined()

    genMock.mockClear()
    await POST(req({ idea: 'x', challenge: true }))
    expect(typeof genMock.mock.calls[0][0].dayNumber).toBe('number')
  })
})
