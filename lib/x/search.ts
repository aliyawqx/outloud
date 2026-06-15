import { SearchUnavailableError, XAuthError } from './errors'
import { spaced } from './throttle'
import { tweetIdFromUrl } from './fetchPost'
import { findTweetUrlsViaWeb } from '@/lib/anthropic'

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

function clampMax(max?: number): number {
  return Math.min(100, Math.max(10, max ?? 100))
}

/** Build a CandidatePost from raw fields (shared by every search source). */
function toCandidate(p: {
  id: string
  url?: string
  authorHandle?: string
  authorName?: string
  followers?: number
  text: string
  createdAt: string
  now: number
  likes?: number
  replies?: number
  reposts?: number
  quotes?: number
}): CandidatePost {
  const followers = Math.max(0, p.followers ?? 0)
  const likes = Math.max(0, p.likes ?? 0)
  const replies = Math.max(0, p.replies ?? 0)
  const reposts = Math.max(0, p.reposts ?? 0)
  const quotes = Math.max(0, p.quotes ?? 0)
  const ageHours = Math.max(0, (p.now - new Date(p.createdAt).getTime()) / 3600000)
  const handle = (p.authorHandle || '').trim()
  return {
    id: p.id,
    url: p.url || `https://x.com/${handle || 'i'}/status/${p.id}`,
    authorHandle: handle,
    authorName: p.authorName || handle,
    followers,
    text: p.text,
    createdAt: p.createdAt,
    ageHours: Math.round(ageHours * 10) / 10,
    likes,
    replies,
    reposts,
    quotes,
    engagement: likes + replies + reposts + quotes,
    reachScore: computeReachScore({ followers, likes, replies, reposts, quotes, ageHours }),
  }
}

/** Source A — the official X recent-search API (paid). Uses the user's token. */
async function searchViaXApi(accessToken: string, q: string, now: number, max: number): Promise<CandidatePost[]> {
  const startTime = new Date(now - WINDOW_HOURS * 3600 * 1000).toISOString()
  const url = new URL(`${API}/tweets/search/recent`)
  url.searchParams.set('query', `${q} lang:en -is:retweet -is:reply -is:quote`)
  url.searchParams.set('max_results', String(max))
  url.searchParams.set('start_time', startTime)
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
  if (res.status === 401) throw new XAuthError()
  if (res.status === 403 || res.status === 429) throw new SearchUnavailableError()
  if (!res.ok) throw new SearchUnavailableError()

  const data = (await res.json().catch(() => null)) as SearchResponse | null
  const tweets = data?.data ?? []
  const users = new Map((data?.includes?.users ?? []).map((u) => [u.id, u]))
  return tweets.map((t) => {
    const u = users.get(t.author_id)
    const m = t.public_metrics ?? {}
    return toCandidate({
      id: t.id,
      authorHandle: u?.username ?? '',
      authorName: u?.name ?? u?.username ?? '',
      followers: u?.public_metrics?.followers_count ?? 0,
      text: t.text,
      createdAt: t.created_at,
      now,
      likes: m.like_count ?? 0,
      replies: m.reply_count ?? 0,
      reposts: m.retweet_count ?? 0,
      quotes: m.quote_count ?? 0,
    })
  })
}

type WorkerPost = {
  id?: string
  url?: string
  authorHandle?: string
  authorName?: string
  followers?: number
  text?: string
  createdAt?: string
  likes?: number
  replies?: number
  reposts?: number
  quotes?: number
}

/** Source B — a self-hosted worker (Nitter / x-tweet-fetcher) over HTTP. No X
 *  account, no official API. Configure with X_SEARCH_WORKER_URL (+ optional
 *  X_SEARCH_WORKER_TOKEN). Spaced + a generous timeout to stay gentle on it. */
async function searchViaWorker(base: string, q: string, now: number, max: number): Promise<CandidatePost[]> {
  const u = new URL(base.replace(/\/+$/, '') + '/search')
  u.searchParams.set('q', q)
  u.searchParams.set('hours', String(WINDOW_HOURS))
  u.searchParams.set('limit', String(max))

  const headers: Record<string, string> = { accept: 'application/json' }
  if (process.env.X_SEARCH_WORKER_TOKEN) headers.authorization = `Bearer ${process.env.X_SEARCH_WORKER_TOKEN}`

  await spaced('x-search-worker', 1500, 800)
  let res: Response
  try {
    res = await fetch(u, { headers, signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new SearchUnavailableError()
  }
  if (!res.ok) throw new SearchUnavailableError()

  const data = (await res.json().catch(() => null)) as { posts?: WorkerPost[] } | WorkerPost[] | null
  const list: WorkerPost[] = Array.isArray(data) ? data : data?.posts ?? []
  return list
    .filter((p): p is WorkerPost & { id: string; text: string } => Boolean(p && p.id && typeof p.text === 'string' && p.text.trim()))
    .map((p) =>
      toCandidate({
        id: p.id,
        url: p.url,
        authorHandle: p.authorHandle,
        authorName: p.authorName,
        followers: p.followers,
        text: p.text.trim(),
        createdAt: p.createdAt || new Date(now).toISOString(),
        now,
        likes: p.likes ?? 0,
        replies: p.replies ?? 0,
        reposts: p.reposts ?? 0,
        quotes: p.quotes ?? 0,
      }),
    )
}

type FxFull = {
  tweet?: {
    id?: string
    url?: string
    text?: string
    created_timestamp?: number
    likes?: number
    retweets?: number
    replies?: number
    views?: number
    author?: { name?: string; screen_name?: string; followers?: number }
  }
}

/** Resolve a tweet id to a REAL post via FxTwitter (anonymous, no X account):
 *  confirms it exists and pulls true text + engagement. Returns null on failure. */
async function resolveTweet(id: string, now: number): Promise<CandidatePost | null> {
  await spaced('x-read', 600, 400)
  let res: Response
  try {
    res = await fetch(`https://api.fxtwitter.com/status/${id}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  } catch {
    return null
  }
  if (!res.ok) return null
  const t = ((await res.json().catch(() => null)) as FxFull | null)?.tweet
  const text = typeof t?.text === 'string' ? t.text.trim() : ''
  if (!t || !text) return null
  const handle = (t.author?.screen_name || '').trim()
  return toCandidate({
    id,
    url: t.url,
    authorHandle: handle,
    authorName: t.author?.name,
    followers: t.author?.followers ?? 0,
    text,
    createdAt: t.created_timestamp ? new Date(t.created_timestamp * 1000).toISOString() : new Date(now).toISOString(),
    now,
    likes: t.likes ?? 0,
    replies: t.replies ?? 0,
    reposts: t.retweets ?? 0,
    quotes: 0,
  })
}

/** Source C — LLM web-search discovery. The model finds candidate tweet URLs;
 *  each is then VERIFIED + enriched via FxTwitter so we only ever surface real,
 *  replyable posts with true metrics. No official X API, no user account. */
async function searchViaLLM(topic: string, now: number, max: number): Promise<CandidatePost[]> {
  const urls = await findTweetUrlsViaWeb(topic, Math.min(max, 18))
  const ids = [...new Set(urls.map((u) => tweetIdFromUrl(u)).filter((x): x is string => Boolean(x)))].slice(0, 18)
  if (!ids.length) return []
  const resolved = await Promise.all(ids.map((id) => resolveTweet(id, now)))
  return resolved.filter((p): p is CandidatePost => Boolean(p))
}

/**
 * THE search seam (Mode B). Recent original posts on a topic in the last 24h,
 * ranked by the reach approximation. Source is chosen by X_SEARCH_PROVIDER:
 * 'llm' (web-search + FxTwitter verify), else the self-hosted worker when
 * X_SEARCH_WORKER_URL is set, else the official X API (the user's token). Results
 * are cached per topic for a few minutes so re-opening the feed doesn't re-fetch.
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

  const max = clampMax(opts.max)
  const provider = (process.env.X_SEARCH_PROVIDER || '').toLowerCase()
  const worker = process.env.X_SEARCH_WORKER_URL
  const mapped =
    provider === 'llm'
      ? await searchViaLLM(q, now, max)
      : worker
        ? await searchViaWorker(worker, q, now, max)
        : await searchViaXApi(accessToken, q, now, max)

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
