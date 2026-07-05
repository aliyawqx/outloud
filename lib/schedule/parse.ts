import { isSchedulePlatform, type ScheduledMedia, type SchedulePlatform } from './types'

/** Body → validated platform list (deduped). Null = invalid/empty — any
 *  unknown platform rejects the whole list rather than being silently dropped. */
export function parsePlatforms(raw: unknown): SchedulePlatform[] | null {
  if (!Array.isArray(raw)) return null
  if (!raw.every(isSchedulePlatform)) return null
  const out = [...new Set(raw)]
  return out.length ? out : null
}

/** Body → up to 4 validated media refs. null = no media (null/undefined/[]);
 *  'invalid' = malformed value (routes must 400). */
export function parseMedia(raw: unknown): ScheduledMedia[] | null | 'invalid' {
  if (raw === null || raw === undefined) return null
  if (!Array.isArray(raw)) return 'invalid'
  const out: ScheduledMedia[] = []
  for (const m of raw.slice(0, 4)) {
    if (!m || typeof m !== 'object' || typeof (m as { url?: unknown }).url !== 'string') return 'invalid'
    const alt = (m as { alt?: unknown }).alt
    out.push({ url: (m as { url: string }).url, ...(typeof alt === 'string' ? { alt } : {}) })
  }
  return out.length ? out : null
}
