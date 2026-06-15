import { SearchUnavailableError } from './errors'
import { spaced } from './throttle'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const ENT: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&nbsp;': ' ',
}
function decode(s: string): string {
  return s.replace(/&#x?[0-9a-f]+;|&[a-z]+;/gi, (e) => {
    if (ENT[e]) return ENT[e]
    let m = e.match(/^&#x([0-9a-f]+);$/i)
    if (m) return String.fromCodePoint(parseInt(m[1], 16))
    m = e.match(/^&#(\d+);$/)
    if (m) return String.fromCodePoint(parseInt(m[1], 10))
    return e
  })
}
function stripHtml(html: string): string {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').trim()
}

/** Parse a Nitter RSS feed into a user's recent ORIGINAL post texts. Skips
 *  retweets (dc:creator != @handle) and replies (text starts with @). */
export function parseNitterRss(xml: string, handle: string, max: number): string[] {
  const want = ('@' + handle.replace(/^@/, '')).toLowerCase()
  const out: string[] = []
  for (const raw of xml.split('<item>').slice(1)) {
    const item = raw.split('</item>')[0]
    const creator = (item.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/)?.[1] || '').trim().toLowerCase()
    if (creator && creator !== want) continue
    let desc = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || ''
    const cdata = desc.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
    if (cdata) desc = cdata[1]
    let text = stripHtml(decode(desc))
    if (!text) {
      const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
      text = decode(title.replace(/<!\[CDATA\[|\]\]>/g, '')).trim()
    }
    if (!text || text.startsWith('@')) continue
    out.push(text)
    if (out.length >= max) break
  }
  return out
}

/** Import path A — fetch Nitter RSS DIRECTLY from this (Vercel) Node route, no
 *  separate worker. Needs NITTER_BASE. Fragile from datacenter IPs, but no infra. */
export async function fetchTimelineDirect(handle: string, max: number): Promise<string[]> {
  const base = process.env.NITTER_BASE
  if (!base) throw new SearchUnavailableError()
  const url = `${base.replace(/\/+$/, '')}/${handle.replace(/^@/, '')}/rss`
  await spaced('x-timeline', 1200, 600)
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new SearchUnavailableError()
  }
  if (!res.ok) throw new SearchUnavailableError()
  const xml = await res.text().catch(() => '')
  return parseNitterRss(xml, handle, max)
}

/** Import path B — via the self-hosted worker (Nitter), if X_SEARCH_WORKER_URL is set. */
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
  return (data?.posts ?? []).map((p) => (p?.text || '').trim()).filter(Boolean).slice(0, max)
}

/**
 * A user's recent original posts (for voice capture) via Nitter, by @handle — no
 * official X API, no account. Uses the worker when X_SEARCH_WORKER_URL is set,
 * otherwise fetches Nitter RSS directly (NITTER_BASE) — works on Vercel with no
 * extra infra. Throws SearchUnavailableError on failure so import can fall back.
 */
export async function fetchTimeline(handle: string, max: number): Promise<string[]> {
  if (process.env.X_SEARCH_WORKER_URL) return fetchTimelineViaWorker(handle, max)
  return fetchTimelineDirect(handle, max)
}
