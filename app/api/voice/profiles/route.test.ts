import { vi, describe, it, expect, beforeEach } from 'vitest'

const { createMock, listMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  listMock: vi.fn(),
}))
vi.mock('@/lib/voice/store', () => ({
  createProfile: createMock,
  listProfiles: listMock,
}))

import { GET, POST } from '@/app/api/voice/profiles/route'

const OWNER = 'owner-abc12345'

function req(method: string, body?: unknown, owner: string | null = OWNER) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (owner) headers['x-owner-key'] = owner
  return new Request('http://localhost/api/voice/profiles', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  createMock.mockReset()
  listMock.mockReset()
})

describe('GET /api/voice/profiles', () => {
  it('401s without an owner key', async () => {
    const res = await GET(req('GET', undefined, null))
    expect(res.status).toBe(401)
    expect(listMock).not.toHaveBeenCalled()
  })

  it('lists the caller-scoped profiles', async () => {
    listMock.mockResolvedValue([{ id: 'p1' }])
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    expect((await res.json()).profiles).toEqual([{ id: 'p1' }])
    expect(listMock).toHaveBeenCalledWith(OWNER)
  })
})

describe('POST /api/voice/profiles', () => {
  it('401s without an owner key', async () => {
    const res = await POST(req('POST', { name: 'x', sources: [{ sourceId: 'naval' }] }, null))
    expect(res.status).toBe(401)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('400s on an invalid body', async () => {
    const res = await POST(req('POST', { name: '' }))
    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('blends real sources, scopes to owner, returns 201', async () => {
    createMock.mockImplementation(async (rec) => ({ id: 'new', ...rec }))
    const res = await POST(req('POST', { name: 'PG + Naval', sources: [{ sourceId: 'paul-graham' }, { sourceId: 'naval' }] }))
    expect(res.status).toBe(201)

    const rec = createMock.mock.calls[0][0]
    expect(rec.ownerKey).toBe(OWNER)
    expect(rec.kind).toBe('inspiration')
    expect(rec.sources).toEqual([
      { sourceId: 'paul-graham', weight: 1 },
      { sourceId: 'naval', weight: 1 },
    ])
    expect(rec.mergedTags).toContain('aphoristic') // from naval
    expect(rec.mergedTags).toContain('essayist') // from paul-graham
    expect(rec.styleSummary).toContain('A hybrid voice blending')
  })

  it('400s on an unknown source id', async () => {
    const res = await POST(req('POST', { name: 'bad', sources: [{ sourceId: 'nobody' }] }))
    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('saves an own voice with no sources and a placeholder summary', async () => {
    createMock.mockImplementation(async (rec) => ({ id: 'me', ...rec }))
    const res = await POST(req('POST', { name: 'Me', kind: 'own', sources: [] }))
    expect(res.status).toBe(201)
    const rec = createMock.mock.calls[0][0]
    expect(rec.kind).toBe('own')
    expect(rec.sources).toEqual([])
    expect(rec.styleSummary).toContain('Your own captured voice')
  })
})
