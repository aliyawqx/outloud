import { vi, describe, it, expect, beforeEach } from 'vitest'

const { createMock, listMock, sessionMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  listMock: vi.fn(),
  sessionMock: vi.fn(),
}))
vi.mock('@/lib/voice/store', () => ({ createProfile: createMock, listProfiles: listMock }))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))

import { GET, POST } from '@/app/api/voice/profiles/route'

const OWNER = 'user-abc123'

function body(b: unknown) {
  return new Request('http://localhost/api/voice/profiles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(b),
  }) as never
}

beforeEach(() => {
  createMock.mockReset()
  listMock.mockReset()
  sessionMock.mockReset()
  sessionMock.mockResolvedValue({ userId: OWNER, email: 'a@b.com' })
})

describe('GET /api/voice/profiles', () => {
  it('401s when not signed in', async () => {
    sessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(listMock).not.toHaveBeenCalled()
  })

  it('lists the signed-in user’s profiles', async () => {
    listMock.mockResolvedValue([{ id: 'p1' }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).profiles).toEqual([{ id: 'p1' }])
    expect(listMock).toHaveBeenCalledWith(OWNER)
  })
})

describe('POST /api/voice/profiles', () => {
  it('401s when not signed in', async () => {
    sessionMock.mockResolvedValue(null)
    const res = await POST(body({ name: 'x', sources: [{ sourceId: 'naval' }] }))
    expect(res.status).toBe(401)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('400s on an invalid body', async () => {
    const res = await POST(body({ name: '' }))
    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('blends real sources, scopes to the user id, returns 201', async () => {
    createMock.mockImplementation(async (rec) => ({ id: 'new', ...rec }))
    const res = await POST(body({ name: 'PG + Naval', sources: [{ sourceId: 'paul-graham' }, { sourceId: 'naval' }] }))
    expect(res.status).toBe(201)

    const rec = createMock.mock.calls[0][0]
    expect(rec.ownerKey).toBe(OWNER)
    expect(rec.kind).toBe('inspiration')
    expect(rec.mergedTags).toContain('aphoristic')
    expect(rec.mergedTags).toContain('essayist')
    expect(rec.styleSummary).toContain('A hybrid voice blending')
  })

  it('400s on an unknown source id', async () => {
    const res = await POST(body({ name: 'bad', sources: [{ sourceId: 'nobody' }] }))
    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('saves an own voice with no sources and a placeholder summary', async () => {
    createMock.mockImplementation(async (rec) => ({ id: 'me', ...rec }))
    const res = await POST(body({ name: 'Me', kind: 'own', sources: [] }))
    expect(res.status).toBe(201)
    const rec = createMock.mock.calls[0][0]
    expect(rec.kind).toBe('own')
    expect(rec.sources).toEqual([])
    expect(rec.styleSummary).toContain('Your own captured voice')
  })
})
