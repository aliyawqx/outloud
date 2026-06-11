import { SearchUnavailableError, XAuthError } from './errors'

const API = 'https://api.x.com/2'
const WINDOW_HOURS = 24
// Engagement gate: we prefer posts that ALREADY have real traction, not
// fresh-but-tiny ones. A 10-like post is out even from a 5k-follower account.
const MIN_LIKES = 1000
// When nothing in the window clears the ideal bar (niche topics, quiet day), we
// relax to this floor instead of returning an empty feed — still real traction,
// just smaller. reachScore ranking + the judge keep quality up.
const FALLBACK_MIN_LIKES = 100
// Big accounts are the target audience; 100k+ followers gets a strong step up.
const BIG_ACCOUNT_FOLLOWERS = 100_000
const CACHE_TTL_MS = 5 * 60 * 1000 // re-opening a topic shouldn't re-bill for 5 min

export type CandidatePost = {
  id: string
  url: string
  authorHandle: string
  authorName: string
  followers: number
  text: string
  createdAt: string
  ageHours: number
  likes: number
  replies: number
  reposts: number
  quotes: number
  engagement: number
  reachScore: number
}

/**
 * Approximate "high reach" from what the API actually gives us — follower count
 * and engagement. X does NOT expose view/impression counts for other people's
 * posts, so we never claim to filter by views. Pure + testable.
 */
export function computeReachScore(p: {
  followers: number
  likes: number
  replies: number
  reposts: number
  quotes: number
  ageHours?: number
}): number {
  // Engagement-led: likes carry it, reposts/quotes count for more (they spread it).
  const engagement = p.likes + p.reposts * 2 + p.quotes * 2 + p.replies
  // Big-account preference: a strong step at 100k+ followers, modest below.
  const followers = Math.max(0, p.followers)
  const followerBonus =
    followers >= BIG_ACCOUNT_FOLLOWERS ? 4000 + Math.log10(followers) * 300 : Math.log10(followers + 10) * 60
  // Small freshness bonus: engagement that piled up fast is "climbing".
  const velocity = p.ageHours && p.ageHours > 0 ? Math.min(engagement / p.ageHours, engagement) * 0.4 : 0
  return Math.round(engagement + followerBonus + velocity)
}

type SearchResponse = {
  data?: Array<{
    id: string
    text: string
    author_id: string
    created_at: string
    public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number }
  }>
  includes?: {
    users?: Array<{ id: string; username: string; name: string; public_metrics?: { followers_count?: number } }>
  }
}

const cache = new Map<string, { at: number; posts: CandidatePost[] }>()

/**
 * THE search seam (Mode B). Recent original posts on a topic from the last ~12h,
 * ranked by the reach approximation. Uses the user's X token; recent search needs
 * paid API access, so a 401/403 surfaces as SearchUnavailableError. Results are
 * cached per topic for a few minutes so re-opening the feed doesn't re-bill.
 */
export async function searchPosts(
  accessToken: string,
  topic: string,
  opts: { max?: number; now?: number } = {},
): Promise<CandidatePost[]> {
  const q = topic.trim()
  if (!q) return []
  const now = opts.now ?? Date.now()
  const key = q.toLowerCase()
  const hit = cache.get(key)
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.posts

  const startTime = new Date(now - WINDOW_HOURS * 3600 * 1000).toISOString()
  const url = new URL(`${API}/tweets/search/recent`)
  url.searchParams.set('query', `${q} lang:en -is:retweet -is:reply -is:quote`)
  url.searchParams.set('max_results', String(Math.min(100, Math.max(10, opts.max ?? 100))))
  url.searchParams.set('start_time', startTime)
  // Most-engaged matches in the window, NOT just the newest — newest posts haven't
  // accumulated likes yet, so recency sort + a like floor returns almost nothing.
  url.searchParams.set('sort_order', 'relevancy')
  url.searchParams.set('tweet.fields', 'public_metrics,created_at,author_id')
  url.searchParams.set('expansions', 'author_id')
  url.searchParams.set('user.fields', 'public_metrics,name,username')

  let res: Response
  try {
    res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  } catch {
    throw new SearchUnavailableError()
  }
  // Paid-tier / access gating and rate limits → a clean "not available" message.
  if (res.status === 401) throw new XAuthError()
  if (res.status === 403 || res.status === 429) throw new SearchUnavailableError()
  if (!res.ok) throw new SearchUnavailableError()

  const data = (await res.json().catch(() => null)) as SearchResponse | null
  const tweets = data?.data ?? []
  const users = new Map((data?.includes?.users ?? []).map((u) => [u.id, u]))

  const mapped: CandidatePost[] = tweets
    .map((t) => {
      const u = users.get(t.author_id)
      const m = t.public_metrics ?? {}
      const followers = u?.public_metrics?.followers_count ?? 0
      const likes = m.like_count ?? 0
      const replies = m.reply_count ?? 0
      const reposts = m.retweet_count ?? 0
      const quotes = m.quote_count ?? 0
      const ageHours = Math.max(0, (now - new Date(t.created_at).getTime()) / 3600000)
      const handle = u?.username ?? ''
      return {
        id: t.id,
        url: `https://x.com/${handle || 'i'}/status/${t.id}`,
        authorHandle: handle,
        authorName: u?.name ?? handle,
        followers,
        text: t.text,
        createdAt: t.created_at,
        ageHours: Math.round(ageHours * 10) / 10,
        likes,
        replies,
        reposts,
        quotes,
        engagement: likes + replies + reposts + quotes,
        reachScore: computeReachScore({ followers, likes, replies, reposts, quotes, ageHours }),
      }
    })

  // Prefer posts that clear the ideal bar; if none do, relax to the fallback floor
  // so the feed shows the best available instead of a dead end. Rank by reach desc
  // (big accounts / high-engagement first), newest as a tiebreak.
  const byReach = (a: CandidatePost, b: CandidatePost) =>
    b.reachScore - a.reachScore || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  const strong = mapped.filter((p) => p.likes >= MIN_LIKES)
  const posts = (strong.length > 0 ? strong : mapped.filter((p) => p.likes >= FALLBACK_MIN_LIKES)).sort(byReach)

  cache.set(key, { at: now, posts })
  return posts
}
