import { SearchUnavailableError } from './errors'
import { spaced } from './throttle'

/**
 * A user's recent original posts (for voice capture) via the self-hosted worker
 * (Nitter), by @handle — no official X API, no account/token needed. Requires
 * X_SEARCH_WORKER_URL. Throws SearchUnavailableError on any failure so the import
 * route can fall back or message cleanly.
 */
export async function fetchTimelineViaWorker(handle: string, max: number): Promise<string[]> {
  const base = process.env.X_SEARCH_WORKER_URL
  if (!base) throw new SearchUnavailableError()

  const u = new URL(base.replace(/\/+$/, '') + '/timeline')
  u.searchParams.set('handle', handle.replace(/^@/, ''))
  u.searchParams.set('limit', String(Math.min(100, Math.max(5, max))))

  const headers: Record<string, string> = { accept: 'application/json' }
  if (process.env.X_SEARCH_WORKER_TOKEN) headers.authorization = `Bearer ${process.env.X_SEARCH_WORKER_TOKEN}`

  await spaced('x-timeline', 1200, 600)
  let res: Response
  try {
    res = await fetch(u, { headers, signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new SearchUnavailableError()
  }
  if (!res.ok) throw new SearchUnavailableError()

  const data = (await res.json().catch(() => null)) as { posts?: Array<{ text?: string }> } | null
  return (data?.posts ?? [])
    .map((p) => (p?.text || '').trim())
    .filter(Boolean)
    .slice(0, max)
}
