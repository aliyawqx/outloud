import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock, getProfileMock, listProfilesMock, enabledMock, intakeMock, genMock, saveMock, updateMock, getEntryMock, userProfileMock, incDraftsMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  getProfileMock: vi.fn(),
  listProfilesMock: vi.fn(),
  enabledMock: vi.fn(),
  intakeMock: vi.fn(),
  genMock: vi.fn(),
  saveMock: vi.fn(),
  updateMock: vi.fn(),
  getEntryMock: vi.fn(),
  userProfileMock: vi.fn(),
  incDraftsMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/voice/store', () => ({ getProfile: getProfileMock, listProfiles: listProfilesMock }))
vi.mock('@/lib/voice/samples', () => ({ listEnabledTexts: enabledMock }))
vi.mock('@/lib/voice/history', () => ({ saveComposeSession: saveMock, updateComposeChat: updateMock, getComposeEntry: getEntryMock }))
vi.mock('@/lib/profile/store', () => ({ getProfile: userProfileMock, incrementDraftsUsed: incDraftsMock }))
vi.mock('@/lib/prompts/store', () => ({ getPromptText: vi.fn(async () => 'FORMAT: a standard X post') }))
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
  sessionMock.mockReset(); getProfileMock.mockReset(); listProfilesMock.mockReset(); enabledMock.mockReset(); intakeMock.mockReset(); genMock.mockReset(); saveMock.mockReset(); updateMock.mockReset(); getEntryMock.mockReset(); userProfileMock.mockReset(); incDraftsMock.mockReset()
  saveMock.mockResolvedValue({ id: 'h1' })
  userProfileMock.mockResolvedValue({ draftsUsed: 0 })
  incDraftsMock.mockResolvedValue(1)
  sessionMock.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
  getProfileMock.mockResolvedValue(readyVoice)
  listProfilesMock.mockResolvedValue([readyVoice])
  enabledMock.mockResolvedValue(['a sample'])
})

describe('POST /api/voice/chat', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await POST(json({ turns: [{ role: 'user', text: 'hi' }], profileId: 'p1' }))).status).toBe(401)
  })

  it('409 needsVoice when the voice is not ready', async () => {
    getProfileMock.mockResolvedValue({ ...readyVoice, styleGuide: '' }) // not ready
    const res = await POST(json({ turns: [{ role: 'user', text: 'hi' }], profileId: 'p1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).needsVoice).toBe(true)
    expect(intakeMock).not.toHaveBeenCalled()
  })

  it('403 when the draft cap is reached, before any generation', async () => {
    userProfileMock.mockResolvedValue({ draftsUsed: 5 }) // at the limit
    const res = await POST(json({ turns: [{ role: 'user', text: 'hi' }], profileId: 'p1' }))
    expect(res.status).toBe(403)
    expect((await res.json()).limitReached).toBe(true)
    expect(intakeMock).not.toHaveBeenCalled()
  })

  it('counts a produced draft toward the cap and returns draftsLeft', async () => {
    userProfileMock.mockResolvedValue({ draftsUsed: 2 })
    incDraftsMock.mockResolvedValue(3)
    intakeMock.mockResolvedValue({ action: 'write', brief: 'shipped' })
    genMock.mockResolvedValue({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'the post' }], clarify: '' })
    const res = await POST(json({ turns: [{ role: 'user', text: 'shipped billing' }], profileId: 'p1' }))
    expect(res.status).toBe(200)
    expect(incDraftsMock).toHaveBeenCalledWith('u1')
    expect((await res.json()).draftsLeft).toBe(2) // 5 - 3
  })

  it('returns ONE follow-up question when intake decides to ask', async () => {
    intakeMock.mockResolvedValue({ action: 'ask', question: 'x or linkedin?', options: ['X', 'LinkedIn', 'Both'] })
    const res = await POST(json({ turns: [{ role: 'user', text: 'got into an incubator' }], profileId: 'p1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ask).toBe('x or linkedin?')
    expect(body.options).toEqual(['X', 'LinkedIn', 'Both'])
    expect(genMock).not.toHaveBeenCalled()
    // A question is the first AI answer → the chat is saved to History right away,
    // with the question stored as an assistant turn and no drafts yet.
    expect(body.historyId).toBe('h1')
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      idea: 'got into an incubator',
      drafts: [],
      messages: [
        { role: 'user', text: 'got into an incubator' },
        { role: 'assistant', text: 'x or linkedin?' },
      ],
    }))
  })

  it('writes a draft, saves ONE history entry with the transcript', async () => {
    intakeMock.mockResolvedValue({ action: 'write', brief: 'shipped billing on x' })
    genMock.mockResolvedValue({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'the post' }], clarify: '' })
    const res = await POST(json({ turns: [{ role: 'user', text: 'shipped billing for x' }], profileId: 'p1' }))
    expect(res.status).toBe(200)
    expect(genMock).toHaveBeenCalledWith(expect.objectContaining({ idea: 'shipped billing on x', reviseBase: undefined, samples: ['a sample'] }))
    const body = await res.json()
    expect(body.draft.fullText).toBe('the post')
    expect(body.historyId).toBe('h1')
    // transcript persisted = the user turn + the new draft turn
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      idea: 'shipped billing for x',
      messages: [{ role: 'user', text: 'shipped billing for x' }, { role: 'assistant', draft: expect.objectContaining({ fullText: 'the post' }) }],
    }))
  })

  it('edits the last draft in place (keeps voice) on a follow-up, updating the same entry', async () => {
    intakeMock.mockResolvedValue({ action: 'write', brief: 'ignored for revisions' })
    genMock.mockResolvedValue({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'revised post' }], clarify: '' })
    getEntryMock.mockResolvedValue({ id: 'h1' }) // existing entry
    const res = await POST(json({
      turns: [
        { role: 'user', text: 'shipped billing' },
        { role: 'assistant', draft: { angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'first draft in elon voice' } },
        { role: 'user', text: 'add that it was zero budget' },
      ],
      profileId: 'p1',
      historyId: 'h1',
    }))
    expect(res.status).toBe(200)
    expect(genMock).toHaveBeenCalledWith(expect.objectContaining({
      reviseBase: 'first draft in elon voice',
      idea: 'add that it was zero budget',
    }))
    // same entry updated; both drafts kept in the transcript
    expect(updateMock).toHaveBeenCalledWith('u1', 'h1', expect.objectContaining({
      drafts: [expect.objectContaining({ fullText: 'first draft in elon voice' }), expect.objectContaining({ fullText: 'revised post' })],
    }))
    expect(saveMock).not.toHaveBeenCalled()
  })
})
