import { isSchedulePlatform, type ScheduledMedia, type SchedulePlatform } from './types'

/** Body → validated platform list (deduped). Null = invalid/empty. */
export function parsePlatforms(raw: unknown): SchedulePlatform[] | null {
  if (!Array.isArray(raw)) return null
  const out = [...new Set(raw.filter(isSchedulePlatform))]
  return out.length ? out : null
}

/** Body → up to 4 validated media refs. Null = none. */
export function parseMedia(raw: unknown): ScheduledMedia[] | null {
  if (!Array.isArray(raw)) return null
  const out: ScheduledMedia[] = []
  for (const m of raw.slice(0, 4)) {
    if (m && typeof m === 'object' && typeof (m as { url?: unknown }).url === 'string') {
      const alt = (m as { alt?: unknown }).alt
      out.push({ url: (m as { url: string }).url, ...(typeof alt === 'string' ? { alt } : {}) })
    }
  }
  return out.length ? out : null
}
