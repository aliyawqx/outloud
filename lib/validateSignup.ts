// X handles: 1–15 chars, letters/digits/underscore. A leading @ is stripped.
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SignupInput = { handle?: unknown; email?: unknown }
export type SignupValue = { handle: string; email: string }
export type ValidationResult =
  | { ok: true; value: SignupValue }
  | { ok: false; error: string }

export function validateSignup(input: SignupInput): ValidationResult {
  const raw = typeof input.handle === 'string' ? input.handle.trim().replace(/^@+/, '') : ''
  if (!HANDLE_RE.test(raw)) {
    return { ok: false, error: 'Enter a valid X handle (letters, numbers, underscore).' }
  }
  const handle = raw.toLowerCase()

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Enter a valid email.' }
  }

  return { ok: true, value: { handle, email } }
}
