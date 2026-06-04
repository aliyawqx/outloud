import type { ProfileKind, SourceRef } from './types'

const NAME_MAX = 80
const MAX_SOURCES = 5
const WEIGHT_MAX = 100
const KINDS: ProfileKind[] = ['own', 'inspiration']

export type CreateProfileValue = {
  name: string
  kind: ProfileKind
  /** Deduped by sourceId. Empty for an 'own' voice. Existence is checked by the route. */
  sources: SourceRef[]
  isActive: boolean
}

export type UpdateProfileValue = {
  name?: string
  sources?: SourceRef[]
  isActive?: boolean
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

/** Shape-validate & normalize a sources array. Existence in the catalog is the route's job. */
function parseSources(raw: unknown): { ok: true; sources: SourceRef[] } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, sources: [] }
  if (!Array.isArray(raw)) return { ok: false, error: 'Sources must be a list.' }

  const seen = new Set<string>()
  const sources: SourceRef[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { ok: false, error: 'Each source must be an object.' }
    const sourceId = (item as { sourceId?: unknown }).sourceId
    if (typeof sourceId !== 'string' || !sourceId.trim()) {
      return { ok: false, error: 'Each source needs a sourceId.' }
    }
    const id = sourceId.trim()
    if (seen.has(id)) continue // ignore duplicates
    seen.add(id)

    let weight = 1
    const w = (item as { weight?: unknown }).weight
    if (w !== undefined) {
      if (typeof w !== 'number' || !Number.isFinite(w) || w <= 0 || w > WEIGHT_MAX) {
        return { ok: false, error: 'Weights must be numbers between 0 and 100.' }
      }
      weight = w
    }
    sources.push({ sourceId: id, weight })
  }
  if (sources.length > MAX_SOURCES) {
    return { ok: false, error: `Blend at most ${MAX_SOURCES} creators.` }
  }
  return { ok: true, sources }
}

function parseName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'Give your voice a name.' }
  const name = raw.trim()
  if (name.length > NAME_MAX) return { ok: false, error: `Keep the name under ${NAME_MAX} characters.` }
  return { ok: true, name }
}

/** Validate the body for creating a profile. */
export function validateCreateProfile(input: unknown): Validation<CreateProfileValue> {
  const body = (input ?? {}) as Record<string, unknown>

  const nameR = parseName(body.name)
  if (!nameR.ok) return nameR

  let kind: ProfileKind = 'inspiration'
  if (body.kind !== undefined) {
    if (!KINDS.includes(body.kind as ProfileKind)) return { ok: false, error: 'Invalid voice kind.' }
    kind = body.kind as ProfileKind
  }

  const srcR = parseSources(body.sources)
  if (!srcR.ok) return srcR

  if (kind === 'inspiration' && srcR.sources.length === 0) {
    return { ok: false, error: 'Pick at least one creator to blend.' }
  }
  // An 'own' voice has no inspiration sources.
  const sources = kind === 'own' ? [] : srcR.sources

  const isActive = body.isActive === undefined ? false : Boolean(body.isActive)

  return { ok: true, value: { name: nameR.name, kind, sources, isActive } }
}

/** Validate the body for a partial update. Every field is optional. */
export function validateUpdateProfile(input: unknown): Validation<UpdateProfileValue> {
  const body = (input ?? {}) as Record<string, unknown>
  const value: UpdateProfileValue = {}

  if (body.name !== undefined) {
    const nameR = parseName(body.name)
    if (!nameR.ok) return nameR
    value.name = nameR.name
  }
  if (body.sources !== undefined) {
    const srcR = parseSources(body.sources)
    if (!srcR.ok) return srcR
    value.sources = srcR.sources
  }
  if (body.isActive !== undefined) {
    value.isActive = Boolean(body.isActive)
  }
  if (value.name === undefined && value.sources === undefined && value.isActive === undefined) {
    return { ok: false, error: 'Nothing to update.' }
  }
  return { ok: true, value }
}
