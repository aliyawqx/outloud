import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

export const maxDuration = 20

// GET /api/images/search?q= — Unsplash stock photo search. FREE: we charge credits
// only when the user picks a photo (see /api/images/pick). Returns just what the
// grid + the later pick need (thumb, full url, attribution, download_location).
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return NextResponse.json({ error: 'Photo search is not available.' }, { status: 503 })

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })

  try {
    const u = new URL('https://api.unsplash.com/search/photos')
    u.searchParams.set('query', q)
    u.searchParams.set('per_page', '24')
    u.searchParams.set('content_filter', 'high')
    const res = await fetch(u, {
      headers: { authorization: `Client-ID ${key}`, 'accept-version': 'v1' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      console.error('[images/search] unsplash status', res.status)
      return NextResponse.json({ error: "Couldn't search photos right now." }, { status: 502 })
    }
    const data = (await res.json()) as {
      results?: Array<{
        id: string
        alt_description?: string | null
        urls?: { small?: string; regular?: string }
        links?: { download_location?: string }
        user?: { name?: string; links?: { html?: string } }
      }>
    }
    const results = (data.results ?? [])
      .filter((p) => p.urls?.small && p.urls?.regular && p.links?.download_location)
      .map((p) => ({
        id: p.id,
        thumbUrl: p.urls!.small!,
        fullUrl: p.urls!.regular!,
        downloadLocation: p.links!.download_location!,
        alt: p.alt_description ?? '',
        photographer: p.user?.name ?? '',
        photographerUrl: p.user?.links?.html ?? '',
      }))
    return NextResponse.json({ results })
  } catch (err) {
    console.error('[images/search] failed:', err)
    return NextResponse.json({ error: "Couldn't search photos right now." }, { status: 502 })
  }
}
