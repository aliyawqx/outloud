// Fetch a reference URL server-side and extract readable text. Conservative:
// http(s) only, blocks obvious private hosts (basic SSRF guard), times out, and
// caps the response + extracted size.

const TIMEOUT_MS = 8000
const MAX_BYTES = 200_000
const MAX_CHARS = 8000

export class UrlFetchError extends Error {}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h.endsWith('.local') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  )
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchSampleFromUrl(url: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UrlFetchError('Invalid URL.')
  }
  if (!/^https?:$/.test(parsed.protocol) || isBlockedHost(parsed.hostname)) {
    throw new UrlFetchError('That URL is not allowed.')
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      headers: { 'user-agent': 'OutloudBot/1.0' },
      redirect: 'follow',
    })
    if (!res.ok) throw new UrlFetchError(`Could not fetch that URL (${res.status}).`)
    const buf = await res.arrayBuffer()
    const raw = new TextDecoder().decode(buf.slice(0, MAX_BYTES))
    const isHtml = (res.headers.get('content-type') ?? '').includes('html') || /<[a-z!]/i.test(raw.slice(0, 200))
    const text = (isHtml ? stripHtml(raw) : raw).slice(0, MAX_CHARS).trim()
    if (!text) throw new UrlFetchError('No readable text found at that URL.')
    return text
  } catch (err) {
    if (err instanceof UrlFetchError) throw err
    throw new UrlFetchError('Could not fetch that URL.')
  } finally {
    clearTimeout(timer)
  }
}
