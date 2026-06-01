// Twitter/X handles: 1–15 chars, letters/digits/underscore. A leading @ is stripped.
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/
const SHIPPING_MAX = 280

export type SignupInput = { handle?: unknown; shipping?: unknown }
export type SignupValue = { handle: string; shipping: string | null }
export type ValidationResult =
  | { ok: true; value: SignupValue }
  | { ok: false; error: string }

export function validateSignup(input: SignupInput): ValidationResult {
  const raw = typeof input.handle === 'string' ? input.handle.trim().replace(/^@+/, '') : ''
  if (!HANDLE_RE.test(raw)) {
    return { ok: false, error: 'Enter a valid X handle (letters, numbers, underscore).' }
  }
  const handle = raw.toLowerCase()

  let shipping: string | null = null
  if (typeof input.shipping === 'string') {
    const s = input.shipping.trim()
    if (s.length > SHIPPING_MAX) {
      return { ok: false, error: 'Keep it under 280 characters.' }
    }
    shipping = s.length ? s : null
  }

  return { ok: true, value: { handle, shipping } }
}
