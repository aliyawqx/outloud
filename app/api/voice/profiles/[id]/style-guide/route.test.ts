import { vi, describe, it, expect, beforeEach } from 'vitest'

const { sessionMock, getProfileMock, setGuideMock, enabledMock, genGuideMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  getProfileMock: vi.fn(),
  setGuideMock: vi.fn(),
  enabledMock: vi.fn(),
  genGuideMock: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))
vi.mock('@/lib/voice/store', () => ({ getProfile: getProfileMock, setStyleGuide: setGuideMock }))
vi.mock('@/lib/voice/samples', () => ({ listEnabledTexts: enabledMock }))
vi.mock('@/lib/anthropic', () => ({ generateStyleGuide: genGuideMock }))

import { POST, PATCH } from '@/app/api/voice/profiles/[id]/style-guide/route'

const OWNER = 'user-1'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = () => new Request('http://localhost/x', { method: 'POST' }) as never
const patch = (b: unknown) =>
  new Request('http://localhost/x', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }) as never

beforeEach(() => {
  sessionMock.mockReset(); getProfileMock.mockReset(); setGuideMock.mockReset(); enabledMock.mockReset(); genGuideMock.mockReset()
  sessionMock.mockResolvedValue({ userId: OWNER, email: 'a@b.com' })
  getProfileMock.mockResolvedValue({ id: 'p1', kind: 'own', styleSummary: 'old' })
})

describe('POST style-guide (sample → guide flow)', () => {
  it('401 without session', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await POST(post(), ctx('p1'))).status).toBe(401)
  })

  it('404 when the profile is not the user’s', async () => {
    getProfileMock.mockResolvedValue(null)
    expect((await POST(post(), ctx('p1'))).status).toBe(404)
    expect(genGuideMock).not.toHaveBeenCalled()
  })

  it('400 when no enabled samples', async () => {
    enabledMock.mockResolvedValue([])
    const res = await POST(post(), ctx('p1'))
    expect(res.status).toBe(400)
    expect(genGuideMock).not.toHaveBeenCalled()
  })

  it('analyzes enabled samples and stores the guide', async () => {
    enabledMock.mockResolvedValue(['sample one', 'sample two'])
    genGuideMock.mockResolvedValue({ guideMarkdown: '## Voice summary\ndry', summary: 'dry' })
    setGuideMock.mockResolvedValue({ id: 'p1', styleGuide: '## Voice summary\ndry', styleSummary: 'dry' })

    const res = await POST(post(), ctx('p1'))
    expect(res.status).toBe(200)
    expect(genGuideMock).toHaveBeenCalledWith(['sample one', 'sample two'])
    expect(setGuideMock).toHaveBeenCalledWith(OWNER, 'p1', { guideMarkdown: '## Voice summary\ndry', summary: 'dry' })
    expect((await res.json()).profile.styleSummary).toBe('dry')
  })
})

describe('PATCH style-guide (save edits)', () => {
  it('saves an edited guide, keeping summary when omitted', async () => {
    setGuideMock.mockResolvedValue({ id: 'p1', styleGuide: 'edited', styleSummary: 'old' })
    const res = await PATCH(patch({ guideMarkdown: 'edited' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect(setGuideMock).toHaveBeenCalledWith(OWNER, 'p1', { guideMarkdown: 'edited', summary: 'old' })
  })

  it('400 on an empty guide', async () => {
    expect((await PATCH(patch({ guideMarkdown: '   ' }), ctx('p1'))).status).toBe(400)
  })
})
