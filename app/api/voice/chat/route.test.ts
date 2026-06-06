import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock, getProfileMock, listProfilesMock, enabledMock, intakeMock, genMock, saveMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  getProfileMock: vi.fn(),
  listProfilesMock: vi.fn(),
  enabledMock: vi.fn(),
  intakeMock: vi.fn(),
  genMock: vi.fn(),
  saveMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/voice/store', () => ({ getProfile: getProfileMock, listProfiles: listProfilesMock }))
vi.mock('@/lib/voice/samples', () => ({ listEnabledTexts: enabledMock }))
vi.mock('@/lib/voice/history', () => ({ saveComposeSession: saveMock }))
vi.mock('@/lib/anthropic', () => ({ runIntake: intakeMock }))
vi.mock('@/lib/voice/generate', () => ({
  generatePost: genMock,
  VoiceNotReadyError: class VoiceNotReadyError extends Error {},
}))

import { POST } from '@/app/api/voice/chat/route'

const readyVoice = { id: 'p1', kind: 'own', name: 'My voice', styleGuide: '## g', sources: [] }
const json = (b: unknown) =>
  new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  sessionMock.mockReset(); getProfileMock.mockReset(); listProfilesMock.mockReset(); enabledMock.mockReset(); intakeMock.mockReset(); genMock.mockReset(); saveMock.mockReset()
  saveMock.mockResolvedValue({ id: 'h1' })
  sessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  getProfileMock.mockResolvedValue(readyVoice)
  listProfilesMock.mockResolvedValue([readyVoice])
  enabledMock.mockResolvedValue(['a sample'])
})

describe('POST /api/voice/chat', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await POST(json({ messages: [{ role: 'user', content: 'hi' }], profileId: 'p1' }))).status).toBe(401)
  })

  it('409 needsVoice when the voice is not ready', async () => {
    getProfileMock.mockResolvedValue({ ...readyVoice, styleGuide: '' }) // not ready
    const res = await POST(json({ messages: [{ role: 'user', content: 'hi' }], profileId: 'p1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).needsVoice).toBe(true)
    expect(intakeMock).not.toHaveBeenCalled()
  })

  it('returns ONE follow-up question when intake decides to ask', async () => {
    intakeMock.mockResolvedValue({ action: 'ask', question: 'x or linkedin?' })
    const res = await POST(json({ messages: [{ role: 'user', content: 'got into an incubator' }], profileId: 'p1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ask).toBe('x or linkedin?')
    expect(genMock).not.toHaveBeenCalled()
  })

  it('writes a draft when intake decides there is enough', async () => {
    intakeMock.mockResolvedValue({ action: 'write', brief: 'shipped billing on x' })
    genMock.mockResolvedValue({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'the post' }], clarify: '' })
    const res = await POST(json({ messages: [{ role: 'user', content: 'shipped billing for x' }], profileId: 'p1' }))
    expect(res.status).toBe(200)
    expect(genMock).toHaveBeenCalledWith(expect.objectContaining({ idea: 'shipped billing on x', reviseBase: undefined, samples: ['a sample'] }))
    expect((await res.json()).draft.fullText).toBe('the post')
  })

  it('edits the last draft in place (keeps voice) when lastDraft is provided', async () => {
    intakeMock.mockResolvedValue({ action: 'write', brief: 'ignored for revisions' })
    genMock.mockResolvedValue({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'revised post' }], clarify: '' })
    const res = await POST(json({
      messages: [
        { role: 'user', content: 'shipped billing' },
        { role: 'assistant', content: 'the first draft in elon voice' },
        { role: 'user', content: 'add that it was zero budget' },
      ],
      profileId: 'p1',
      lastDraft: 'the first draft in elon voice',
    }))
    expect(res.status).toBe(200)
    // Revise mode: base = the prior draft, instruction = the latest user message.
    expect(genMock).toHaveBeenCalledWith(expect.objectContaining({
      reviseBase: 'the first draft in elon voice',
      idea: 'add that it was zero budget',
    }))
  })
})
