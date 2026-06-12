import { InvalidPostUrlError, PostUnavailableError } from './errors'
import { spaced, ttlCache } from './throttle'

// A single X post, read for display + as reply context. Kept minimal: enough to
// confirm the post and to feed the reply generator.
export type FetchedPost = {
  id: string
  url: string
  authorHandle: string
  authorName: string
  text: string
  /** Human date string (e.g. "Mar 5, 2026"); approximate. */
  postedAt: string
}

/**
 * Pull the numeric tweet ID out of any x.com / twitter.com post URL (with or
 * without query params, www/mobile subdomains). Returns null if it isn't one.
 */
export function tweetIdFromUrl(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www\.|mobile\.)/, '')
  if (host !== 'x.com' && host !== 'twitter.com') return null
  const m = url.pathname.match(/\/status(?:es)?\/(\d{1,25})/)
  return m ? m[1] : null
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ',
}

function decode(s: string): string {
  return s.replace(/&#x?[0-9a-f]+;|&[a-z]+;/gi, (e) => {
    if (ENTITIES[e]) return ENTITIES[e]
    const num = e.match(/^&#x([0-9a-f]+);$/i)
    if (num) return String.fromCodePoint(parseInt(num[1], 16))
    const dec = e.match(/^&#(\d+);$/)
    if (dec) return String.fromCodePoint(parseInt(dec[1], 10))
    return e
  })
}

function stripTags(html: string): string {
  return decode(html.replace(/<br\s*\/?>(?=)/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').trim()
}

function formatDate(tsSeconds?: number): string {
  if (!tsSeconds) return ''
  try {
    return new Date(tsSeconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

type FxResponse = {
  tweet?: {
    id?: string
    url?: string
    text?: string
    created_at?: string
    created_timestamp?: number
    author?: { name?: string; screen_name?: string }
  }
}

/** Read a single tweet via FxTwitter's free public API (no auth, no X account —
 *  so it can't get the user's account flagged). Returns null so the caller can
 *  fall back to oEmbed. */
export async function fetchViaFx(id: string): Promise<FetchedPost | null> {
  let res: Response
  try {
    res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as FxResponse | null
  const t = data?.tweet
  const text = typeof t?.text === 'string' ? t.text.trim() : ''
  if (!t || !text) return null
  const handle = (t.author?.screen_name || '').trim()
  return {
    id,
    url: t.url || `https://x.com/${handle || 'i'}/status/${id}`,
    authorHandle: handle,
    authorName: (t.author?.name || handle || '').trim(),
    text,
    postedAt: formatDate(t.created_timestamp) || (t.created_at ?? ''),
  }
}

/** Fallback reader: Twitter's free oEmbed endpoint. Returns null on any failure. */
export async function fetchViaOEmbed(id: string): Promise<FetchedPost | null> {
  const tweetUrl = `https://twitter.com/i/status/${id}`
  const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=1&dnt=true`

  let res: Response
  try {
    res = await fetch(endpoint, { headers: { accept: 'application/json' } })
  } catch {
    return null
  }
  if (!res.ok) return null

  const data = (await res.json().catch(() => null)) as
    | { html?: string; author_name?: string; author_url?: string }
    | null
  const html = data?.html
  if (!html) return null

  // Text is the first <p> inside the blockquote.
  const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  const text = pMatch ? stripTags(pMatch[1]) : ''
  if (!text) return null

  // Handle from author_url (…/handle) or the "(@handle)" in the html.
  const handleFromUrl = data?.author_url?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)?.[1]
  const handleFromHtml = html.match(/\(@([A-Za-z0-9_]+)\)/)?.[1]
  const authorHandle = (handleFromUrl || handleFromHtml || '').trim()

  // The last <a> in the blockquote is the date link.
  const anchors = [...html.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
  const postedAt = anchors.length ? stripTags(anchors[anchors.length - 1][1]) : ''

  return {
    id,
    url: `https://x.com/${authorHandle || 'i'}/status/${id}`,
    authorHandle,
    authorName: (data?.author_name || authorHandle || '').trim(),
    text,
    postedAt,
  }
}

const postCache = ttlCache<FetchedPost>('x-post', 10 * 60 * 1000)

/**
 * THE fetch seam (Mode A). Reads a public post WITHOUT the official X API or the
 * user's account: FxTwitter first, oEmbed as a fallback. Cached for 10 min and
 * rate-spaced so repeated/bursty reads don't hammer the source. Throws typed
 * errors the route maps to messages.
 */
export async function fetchPost(rawUrl: string): Promise<FetchedPost> {
  const id = tweetIdFromUrl(rawUrl)
  if (!id) throw new InvalidPostUrlError()

  const cached = postCache.get(id)
  if (cached) return cached

  // Space external reads (per instance) + jitter so traffic doesn't look bursty.
  await spaced('x-read', 700, 500)

  const post = (await fetchViaFx(id)) ?? (await fetchViaOEmbed(id))
  if (!post) throw new PostUnavailableError()

  postCache.set(id, post)
  return post
}
