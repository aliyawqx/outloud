import { ThreadsSearchRateLimitError, ThreadsSearchUnavailableError } from './errors'

const API = 'https://graph.threads.net/v1.0'
// What keyword_search exposes for each hit. There are NO engagement/follower
// metrics here (those are insights, only for the user's own posts), so topic
// results are surfaced without the reach ranking/judge the X branch uses.
const SEARCH_FIELDS = 'id,text,permalink,username,timestamp,has_replies'

export type ThreadsCandidate = {
  id: string
  text: string
  permalink: string
  username: string
  timestamp: string
  hasReplies: boolean
}

type SearchResponse = {
  data?: Array<{
    id?: string
    text?: string
    permalink?: string
    username?: string
    timestamp?: string
    has_replies?: boolean
  }>
  error?: { code?: number; message?: string }
}

/**
 * Topic search on Threads via the keyword_search endpoint. Returns recent posts
 * matching `keyword` (search_type=TOP). Optionally narrow to one author with
 * `authorUsername`. Per-user rate limit is 2200 req/24h; any rate-limit response
 * is surfaced softly as ThreadsSearchRateLimitError.
 *
 * Requires the threads_keyword_search permission — the caller checks that before
 * calling, since without it Meta silently returns only the user's own posts.
 */
export async function searchThreadsPosts(
  accessToken: string,
  keyword: string,
  opts: { authorUsername?: string } = {},
): Promise<ThreadsCandidate[]> {
  const q = keyword.trim()
  if (!q) return []

  const u = new URL(`${API}/keyword_search`)
  u.searchParams.set('q', q)
  u.searchParams.set('search_type', 'TOP')
  u.searchParams.set('fields', SEARCH_FIELDS)
  const author = opts.authorUsername?.trim().replace(/^@/, '')
  if (author) u.searchParams.set('author_username', author)
  u.searchParams.set('access_token', accessToken)

  let res: Response
  try {
    res = await fetch(u)
  } catch {
    throw new ThreadsSearchUnavailableError()
  }

  if (res.status === 429) throw new ThreadsSearchRateLimitError()
  if (!res.ok) {
    // Meta sometimes returns rate-limit hits as a 4xx with an error code rather
    // than a 429; treat those softly too, anything else as a generic failure.
    const data = (await res.json().catch(() => null)) as SearchResponse | null
    const code = data?.error?.code
    const msg = data?.error?.message || ''
    if (code === 4 || code === 17 || code === 32 || /rate limit|too many|limit reached/i.test(msg)) {
      throw new ThreadsSearchRateLimitError()
    }
    throw new ThreadsSearchUnavailableError()
  }

  const data = (await res.json().catch(() => null)) as SearchResponse | null
  const arr = Array.isArray(data?.data) ? data!.data! : []
  // TEMP DEBUG — remove after diagnosing empty results.
  console.log('[threads-search DEBUG] status=%s items=%s raw=%s', res.status, arr.length, JSON.stringify(data)?.slice(0, 1000))
  return arr
    .filter((p): p is { id: string; text: string } & typeof p => Boolean(p && p.id && typeof p.text === 'string' && p.text.trim()))
    .map((p) => ({
      id: p.id,
      text: p.text.trim(),
      permalink: p.permalink || '',
      username: p.username || '',
      timestamp: p.timestamp || '',
      hasReplies: Boolean(p.has_replies),
    }))
}
