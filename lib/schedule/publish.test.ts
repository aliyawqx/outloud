import { describe, expect, it } from 'vitest'
import { decideOutcome, type AttemptResult } from './publish'

const ok = (platform: 'x' | 'threads' | 'linkedin', id: string): AttemptResult => ({ platform, ok: true, id })
const fail = (platform: 'x' | 'threads' | 'linkedin', error: string, transient: boolean): AttemptResult => ({ platform, ok: false, error, transient })

describe('decideOutcome', () => {
  it('publishes on full success', () => {
    const o = decideOutcome(0, [ok('x', '1'), ok('threads', '2')], {})
    expect(o.status).toBe('published')
    expect(o.externalPostIds).toEqual({ x: '1', threads: '2' })
    expect(o.error).toBeNull()
  })

  it('requeues a transient failure while retries remain', () => {
    const o = decideOutcome(0, [ok('x', '1'), fail('threads', 'rate limited', true)], {})
    expect(o.status).toBe('scheduled') // back in the queue = retry
    expect(o.retryCount).toBe(1)
    expect(o.externalPostIds).toEqual({ x: '1' }) // partial success is preserved
    expect(o.error).toContain('threads')
  })

  it('publishes partially once transient retries are exhausted', () => {
    const o = decideOutcome(2, [fail('threads', 'still down', true)], { x: '1' })
    expect(o.status).toBe('published') // X made it; Threads error recorded
    expect(o.externalPostIds).toEqual({ x: '1' })
    expect(o.error).toContain('threads')
    expect(o.retryCount).toBe(2)
  })

  it('does not retry terminal failures — publishes what succeeded', () => {
    const o = decideOutcome(0, [ok('x', '1'), fail('threads', 'not connected', false)], {})
    expect(o.status).toBe('published') // disconnected platform skipped, not fatal
    expect(o.error).toContain('threads')
  })

  it('fails when nothing succeeded and nothing is retryable', () => {
    const o = decideOutcome(0, [fail('x', 'not connected', false), fail('threads', 'auth expired', false)], {})
    expect(o.status).toBe('failed')
  })

  it('fails after retries are exhausted with zero successes', () => {
    const o = decideOutcome(2, [fail('x', 'still down', true)], {})
    expect(o.status).toBe('failed')
  })
})

describe('decideOutcome — rate-limit defer (spec §6)', () => {
  const rl = (platform: 'x' | 'threads' | 'linkedin'): AttemptResult => ({
    platform,
    ok: false,
    error: 'rate limit',
    transient: true,
    rateLimited: true,
  })

  it('defers without burning a retry when every failure is rate-limited', () => {
    const o = decideOutcome(2, [rl('linkedin')], { x: '1' }) // retries already exhausted!
    expect(o.status).toBe('scheduled') // still requeued — 429 never fails a post
    expect(o.retryCount).toBe(2) // unchanged
    expect(o.deferMinutes).toBe(60)
    expect(o.externalPostIds).toEqual({ x: '1' })
  })

  it('uses the normal retry path when rate-limit is mixed with another transient failure', () => {
    const o = decideOutcome(0, [rl('linkedin'), fail('threads', '5xx', true)], {})
    expect(o.status).toBe('scheduled')
    expect(o.retryCount).toBe(1) // normal transient retry
    expect(o.deferMinutes).toBeUndefined()
  })

  it('keeps trying a rate-limited platform even alongside a fresh success', () => {
    const o = decideOutcome(0, [ok('x', '1'), rl('linkedin')], {})
    expect(o.status).toBe('scheduled') // keep trying LinkedIn on the deferred pass
    expect(o.externalPostIds).toEqual({ x: '1' })
    expect(o.deferMinutes).toBe(60)
    expect(o.retryCount).toBe(0)
  })
})
