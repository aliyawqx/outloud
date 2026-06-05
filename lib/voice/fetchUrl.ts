import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Fetch a reference URL server-side and extract readable text. Hardened against
// SSRF: http(s) only, every host (input AND each redirect hop) is resolved to
// its IPs and rejected if any land in a private/reserved range — which also
// defeats DNS-name, IPv6, and alternate-encoding bypasses, since we judge the
// resolved address, not the literal string.

const TIMEOUT_MS = 8000
const MAX_BYTES = 200_000
const MAX_CHARS = 8000
const MAX_REDIRECTS = 5

export class UrlFetchError extends Error {}

/** True if an IPv4/IPv6 address is loopback, private, link-local, or otherwise reserved. */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) {
    const o = ip.split('.').map(Number)
    if (o.length !== 4 || o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
    const [a, b] = o
    return (
      a === 0 || // 0.0.0.0/8
      a === 10 || // 10/8
      a === 127 || // loopback
      (a === 169 && b === 254) || // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // 172.16/12
      (a === 192 && b === 168) || // 192.168/16
      (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
      a >= 224 // multicast / reserved
    )
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase().replace(/^\[|\]$/g, '')
    if (ip6 === '::1' || ip6 === '::') return true
    // IPv4-mapped (::ffff:127.0.0.1) → judge the embedded v4
    const mapped = ip6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIp(mapped[1])
    return (
      ip6.startsWith('fc') || ip6.startsWith('fd') || // unique-local fc00::/7
      ip6.startsWith('fe8') || ip6.startsWith('fe9') || ip6.startsWith('fea') || ip6.startsWith('feb') // link-local fe80::/10
    )
  }
  // Not a recognizable IP literal — treat as unsafe.
  return true
}

/** Resolve a hostname and throw unless EVERY resolved address is public. */
async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new UrlFetchError('That URL is not allowed.')
    return
  }
  let addrs: { address: string }[]
  try {
    addrs = await lookup(host, { all: true })
  } catch {
    throw new UrlFetchError('Could not resolve that URL.')
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new UrlFetchError('That URL is not allowed.')
  }
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

export async function fetchSampleFromUrl(input: string): Promise<string> {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new UrlFetchError('Invalid URL.')
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    // Manually follow redirects so each hop's host is re-validated.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!/^https?:$/.test(url.protocol)) throw new UrlFetchError('That URL is not allowed.')
      await assertPublicHost(url.hostname)

      const res = await fetch(url.toString(), {
        signal: ctrl.signal,
        headers: { 'user-agent': 'OutloudBot/1.0' },
        redirect: 'manual',
      })

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) throw new UrlFetchError('Could not fetch that URL.')
        url = new URL(loc, url) // resolve relative, re-validate on next loop
        continue
      }
      if (!res.ok) throw new UrlFetchError(`Could not fetch that URL (${res.status}).`)

      const buf = await res.arrayBuffer()
      const raw = new TextDecoder().decode(buf.slice(0, MAX_BYTES))
      const isHtml = (res.headers.get('content-type') ?? '').includes('html') || /<[a-z!]/i.test(raw.slice(0, 200))
      const text = (isHtml ? stripHtml(raw) : raw).slice(0, MAX_CHARS).trim()
      if (!text) throw new UrlFetchError('No readable text found at that URL.')
      return text
    }
    throw new UrlFetchError('Too many redirects.')
  } catch (err) {
    if (err instanceof UrlFetchError) throw err
    throw new UrlFetchError('Could not fetch that URL.')
  } finally {
    clearTimeout(timer)
  }
}
