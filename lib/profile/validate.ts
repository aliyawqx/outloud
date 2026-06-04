import type { ProfilePatch } from './store'

const NAME_MAX = 80
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/ // X handle rules

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

/** Validate a profile edit. Empty handle/avatar clear the field (→ null). */
export function validateProfileUpdate(input: unknown): Validation<ProfilePatch> {
  const body = (input ?? {}) as Record<string, unknown>
  const patch: ProfilePatch = {}

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string' || !body.displayName.trim()) {
      return { ok: false, error: 'Give your name.' }
    }
    const name = body.displayName.trim()
    if (name.length > NAME_MAX) return { ok: false, error: `Keep the name under ${NAME_MAX} characters.` }
    patch.displayName = name
  }

  if (body.handle !== undefined) {
    const raw = typeof body.handle === 'string' ? body.handle.trim().replace(/^@/, '') : ''
    if (!raw) patch.handle = null
    else if (!HANDLE_RE.test(raw)) return { ok: false, error: 'Handle: up to 15 letters, numbers or _.' }
    else patch.handle = raw
  }

  if (body.avatarUrl !== undefined) {
    const raw = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : ''
    if (!raw) patch.avatarUrl = null
    else if (!/^https?:\/\/.+/.test(raw)) return { ok: false, error: 'Avatar must be a valid URL.' }
    else patch.avatarUrl = raw
  }

  if (patch.displayName === undefined && patch.handle === undefined && patch.avatarUrl === undefined) {
    return { ok: false, error: 'Nothing to update.' }
  }
  return { ok: true, value: patch }
}
