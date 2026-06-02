import { vi, describe, it, expect, beforeEach } from 'vitest'

const { genMock } = vi.hoisted(() => ({ genMock: vi.fn() }))
vi.mock('@/lib/anthropic', () => ({ generateDrafts: genMock }))

import { POST } from '@/app/api/reply/route'

function post(body: unknown) {
  const req = new Request('http://localhost/api/reply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  // The handler only uses req.json(); a plain Request is sufficient at runtime.
  return POST(req as never)
}

const draft = { angle: 'counter', hook: 'h', story: '', offer: '', fullText: 'a witty reply' }

beforeEach(() => genMock.mockReset())

describe('POST /api/reply', () => {
  it('returns a draft for valid input and calls generateDrafts in reply mode', async () => {
    genMock.mockResolvedValue([draft])
    const res = await post({ samples: ['my post'], replyTo: 'a viral take', angle: 'undercut it' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.draft.fullText).toBe('a witty reply')

    const [profile, opts] = genMock.mock.calls[0]
    expect(profile.samples).toEqual(['my post'])
    expect(opts.kind).toBe('reply')
    expect(opts.replyTo).toBe('a viral take')
    expect(opts.count).toBe(1)
  })

  it('rejects input with no post to reply to (400)', async () => {
    const res = await post({ samples: ['my post'] })
    expect(res.status).toBe(400)
    expect(genMock).not.toHaveBeenCalled()
  })

  it('works with no voice samples (voice is optional)', async () => {
    genMock.mockResolvedValue([draft])
    const res = await post({ replyTo: 'a viral take' })
    expect(res.status).toBe(200)
    expect(genMock.mock.calls[0][1].kind).toBe('reply')
  })

  it('returns 500 when generation yields no draft', async () => {
    genMock.mockResolvedValue([])
    const res = await post({ samples: ['my post'], replyTo: 'a viral take' })
    expect(res.status).toBe(500)
  })
})
