// Phase-1 identity: the client generates a stable anonymous id (stored in
// localStorage) and sends it on every request via the `x-owner-key` header.
// All persistence is scoped to this key. When real auth (Sign in with X) lands,
// replace this with the authenticated user id — nothing else needs to change.

const HEADER = 'x-owner-key'
const MIN = 8
const MAX = 128

/** Extract & lightly validate the owner key from a request. Returns null if absent/invalid. */
export function getOwnerKey(req: Request): string | null {
  const raw = req.headers.get(HEADER)?.trim()
  if (!raw || raw.length < MIN || raw.length > MAX) return null
  // Conservative charset — these are client-generated ids, not free text.
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null
  return raw
}

export const OWNER_KEY_HEADER = HEADER
