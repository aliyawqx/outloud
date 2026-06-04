import { vi, describe, it, expect, beforeEach } from 'vitest'

const { getMock, updateMock, deleteMock, setActiveMock, deactivateMock, sessionMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  setActiveMock: vi.fn(),
  deactivateMock: vi.fn(),
  sessionMock: vi.fn(),
}))
vi.mock('@/lib/voice/store', () => ({
  getProfile: getMock,
  updateProfile: updateMock,
  deleteProfile: deleteMock,
  setActiveProfile: setActiveMock,
  deactivateProfile: deactivateMock,
}))
vi.mock('@/lib/auth/session', () => ({ getSession: sessionMock }))

import { PATCH, DELETE } from '@/app/api/voice/profiles/[id]/route'

const OWNER = 'user-abc123'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function req(body?: unknown) {
  return new Request('http://localhost/api/voice/profiles/p1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  getMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
  setActiveMock.mockReset()
  deactivateMock.mockReset()
  sessionMock.mockReset()
  sessionMock.mockResolvedValue({ userId: OWNER, email: 'a@b.com' })
  getMock.mockResolvedValue({ id: 'p1', ownerKey: OWNER })
})

describe('PATCH /api/voice/profiles/:id', () => {
  it('401s when not signed in', async () => {
    sessionMock.mockResolvedValue(null)
    const res = await PATCH(req({ name: 'x' }), ctx('p1'))
    expect(res.status).toBe(401)
  })

  it('404s when the profile is not the user’s', async () => {
    getMock.mockResolvedValue(null)
    const res = await PATCH(req({ name: 'x' }), ctx('p1'))
    expect(res.status).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('renames via updateProfile, scoped to the user id', async () => {
    updateMock.mockResolvedValue({ id: 'p1', name: 'Renamed' })
    const res = await PATCH(req({ name: 'Renamed' }), ctx('p1'))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(OWNER, 'p1', { name: 'Renamed' })
  })

  it('re-blends when sources change', async () => {
    updateMock.mockResolvedValue({ id: 'p1' })
    const res = await PATCH(req({ sources: [{ sourceId: 'naval' }] }), ctx('p1'))
    expect(res.status).toBe(200)
    const patch = updateMock.mock.calls[0][2]
    expect(patch.sources).toEqual([{ sourceId: 'naval', weight: 1 }])
    expect(patch.mergedTags).toContain('aphoristic')
  })

  it('sets active via setActiveProfile', async () => {
    setActiveMock.mockResolvedValue({ id: 'p1', isActive: true })
    const res = await PATCH(req({ isActive: true }), ctx('p1'))
    expect(res.status).toBe(200)
    expect(setActiveMock).toHaveBeenCalledWith(OWNER, 'p1')
  })

  it('clears active via deactivateProfile', async () => {
    deactivateMock.mockResolvedValue({ id: 'p1', isActive: false })
    const res = await PATCH(req({ isActive: false }), ctx('p1'))
    expect(res.status).toBe(200)
    expect(deactivateMock).toHaveBeenCalledWith(OWNER, 'p1')
  })
})

describe('DELETE /api/voice/profiles/:id', () => {
  it('401s when not signed in', async () => {
    sessionMock.mockResolvedValue(null)
    const res = await DELETE(req(), ctx('p1'))
    expect(res.status).toBe(401)
  })

  it('deletes a user-owned profile', async () => {
    deleteMock.mockResolvedValue(true)
    const res = await DELETE(req(), ctx('p1'))
    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledWith(OWNER, 'p1')
  })

  it('404s when nothing was deleted', async () => {
    deleteMock.mockResolvedValue(false)
    const res = await DELETE(req(), ctx('p1'))
    expect(res.status).toBe(404)
  })
})
