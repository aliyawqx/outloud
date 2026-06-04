import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getMock, updateMock, deleteMock, setActiveMock, deactivateMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  setActiveMock: vi.fn(),
  deactivateMock: vi.fn(),
}))
vi.mock('@/lib/voice/store', () => ({
  getProfile: getMock,
  updateProfile: updateMock,
  deleteProfile: deleteMock,
  setActiveProfile: setActiveMock,
  deactivateProfile: deactivateMock,
}))

import { PATCH, DELETE } from '@/app/api/voice/profiles/[id]/route'

const OWNER = 'owner-abc12345'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function req(method: string, body?: unknown, owner: string | null = OWNER) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (owner) headers['x-owner-key'] = owner
  return new Request('http://localhost/api/voice/profiles/p1', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  getMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
  setActiveMock.mockReset()
  deactivateMock.mockReset()
  getMock.mockResolvedValue({ id: 'p1', ownerKey: OWNER })
})

describe('PATCH /api/voice/profiles/:id', () => {
  it('401s without an owner key', async () => {
    const res = await PATCH(req('PATCH', { name: 'x' }, null), ctx('p1'))
    expect(res.status).toBe(401)
  })

  it('404s when the profile is not the caller’s', async () => {
    getMock.mockResolvedValue(null)
    const res = await PATCH(req('PATCH', { name: 'x' }), ctx('p1'))
    expect(res.status).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('renames via updateProfile', async () => {
    updateMock.mockResolvedValue({ id: 'p1', name: 'Renamed' })
    const res = await PATCH(req('PATCH', { name: 'Renamed' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(OWNER, 'p1', { name: 'Renamed' })
  })

  it('re-blends when sources change', async () => {
    updateMock.mockResolvedValue({ id: 'p1' })
    const res = await PATCH(req('PATCH', { sources: [{ sourceId: 'naval' }] }), ctx('p1'))
    expect(res.status).toBe(200)
    const patch = updateMock.mock.calls[0][2]
    expect(patch.sources).toEqual([{ sourceId: 'naval', weight: 1 }])
    expect(patch.mergedTags).toContain('aphoristic')
    expect(patch.styleSummary).toContain('Naval')
  })

  it('400s on an unknown source id', async () => {
    const res = await PATCH(req('PATCH', { sources: [{ sourceId: 'ghost' }] }), ctx('p1'))
    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('sets active via setActiveProfile', async () => {
    setActiveMock.mockResolvedValue({ id: 'p1', isActive: true })
    const res = await PATCH(req('PATCH', { isActive: true }), ctx('p1'))
    expect(res.status).toBe(200)
    expect(setActiveMock).toHaveBeenCalledWith(OWNER, 'p1')
    expect((await res.json()).profile.isActive).toBe(true)
  })

  it('clears active via deactivateProfile', async () => {
    deactivateMock.mockResolvedValue({ id: 'p1', isActive: false })
    const res = await PATCH(req('PATCH', { isActive: false }), ctx('p1'))
    expect(res.status).toBe(200)
    expect(deactivateMock).toHaveBeenCalledWith(OWNER, 'p1')
  })

  it('400s on an empty patch', async () => {
    const res = await PATCH(req('PATCH', {}), ctx('p1'))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/voice/profiles/:id', () => {
  it('401s without an owner key', async () => {
    const res = await DELETE(req('DELETE', undefined, null), ctx('p1'))
    expect(res.status).toBe(401)
  })

  it('deletes a caller-owned profile', async () => {
    deleteMock.mockResolvedValue(true)
    const res = await DELETE(req('DELETE'), ctx('p1'))
    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledWith(OWNER, 'p1')
  })

  it('404s when nothing was deleted', async () => {
    deleteMock.mockResolvedValue(false)
    const res = await DELETE(req('DELETE'), ctx('p1'))
    expect(res.status).toBe(404)
  })
})
