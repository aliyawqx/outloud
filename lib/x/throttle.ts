// Rate-limit helpers for external tweet reads (FxTwitter / the search worker /
// Nitter). Goal: never burst — space same-source calls out with a minimum gap plus
// a little random jitter so traffic looks human, and cache reads so a repeat doesn't
// hit the source again. In-memory and per serverless instance (best-effort, not a
// global limiter), which combined with caching keeps request volume low.

const lastAt: Record<string, number> = {}

/**
 * Ensure at least `minMs` (plus up to `jitterMs` random) has passed since the last
 * call tagged with `key`; otherwise wait. Serializes spacing per key across
 * concurrent callers by reserving the slot before awaiting.
 */
export async function spaced(key: string, minMs: number, jitterMs = 0): Promise<void> {
  const now = Date.now()
  const prev = lastAt[key] ?? 0
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0
  const readyAt = Math.max(now, prev + minMs) + jitter
  lastAt[key] = readyAt
  const wait = readyAt - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

type Entry<T> = { at: number; value: T }
const caches = new Map<string, Map<string, Entry<unknown>>>()

/**
 * Tiny TTL cache. `get(key)` returns a fresh value or undefined; `set` stores it.
 * Namespaced so different readers don't collide. Used to avoid re-fetching the same
 * post/topic within a short window.
 */
export function ttlCache<T>(namespace: string, ttlMs: number) {
  let store = caches.get(namespace) as Map<string, Entry<T>> | undefined
  if (!store) {
    store = new Map<string, Entry<T>>()
    caches.set(namespace, store as Map<string, Entry<unknown>>)
  }
  return {
    get(key: string): T | undefined {
      const hit = store!.get(key)
      if (hit && Date.now() - hit.at < ttlMs) return hit.value
      if (hit) store!.delete(key)
      return undefined
    },
    set(key: string, value: T): void {
      store!.set(key, { at: Date.now(), value })
    },
  }
}
