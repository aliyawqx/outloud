// Attribution-ref plumbing shared by the client capture component and the
// server-side signup read (pure: no next/headers so client components can import).

export const SIGNUP_REF_COOKIE = 'signup_ref'
export const REF_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60 // 30 days

/** Sane campaign slugs only (e.g. 'ph'); anything else → null. Unknown values
 *  are read-and-ignored for rendering — never a redirect or 404. */
export function sanitizeRef(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const v = raw.trim()
  return /^[\w-]{1,64}$/.test(v) ? v : null
}
