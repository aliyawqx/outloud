import type { SampleSource } from './types'

const SOURCES: SampleSource[] = ['x', 'paste', 'upload', 'url']
const TEXT_MAX = 10_000

export type AddSampleValue =
  | { source: 'paste' | 'upload' | 'x'; text: string }
  | { source: 'url'; url: string }

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

export function validateAddSample(input: unknown): Validation<AddSampleValue> {
  const b = (input ?? {}) as Record<string, unknown>
  const source = b.source
  if (typeof source !== 'string' || !SOURCES.includes(source as SampleSource)) {
    return { ok: false, error: 'Invalid sample source.' }
  }

  if (source === 'url') {
    const url = typeof b.url === 'string' ? b.url.trim() : ''
    if (!/^https?:\/\/.+/.test(url)) return { ok: false, error: 'Enter a valid http(s) URL.' }
    return { ok: true, value: { source: 'url', url } }
  }

  const text = typeof b.text === 'string' ? b.text.trim() : ''
  if (!text) return { ok: false, error: 'Paste some text first.' }
  if (text.length > TEXT_MAX) return { ok: false, error: 'That sample is too long.' }
  return { ok: true, value: { source: source as 'paste' | 'upload' | 'x', text } }
}
