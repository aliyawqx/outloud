// Validation for sign-up / login payloads. Returns the repo's {ok,value}|{ok,error}.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 200
const NAME_MAX = 80

export type SignupValue = { email: string; password: string; displayName: string }
export type LoginValue = { email: string; password: string }
export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

function parseEmail(raw: unknown): { ok: true; email: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'Enter your email.' }
  const email = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email.' }
  return { ok: true, email }
}

export function validateSignup(input: unknown): Validation<SignupValue> {
  const body = (input ?? {}) as Record<string, unknown>

  const emailR = parseEmail(body.email)
  if (!emailR.ok) return emailR

  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < PASSWORD_MIN) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters.` }
  }
  if (password.length > PASSWORD_MAX) return { ok: false, error: 'Password is too long.' }

  let displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (displayName.length > NAME_MAX) return { ok: false, error: `Keep the name under ${NAME_MAX} characters.` }
  // Fall back to the local-part of the email if no name given.
  if (!displayName) displayName = emailR.email.split('@')[0]

  return { ok: true, value: { email: emailR.email, password, displayName } }
}

export function validateLogin(input: unknown): Validation<LoginValue> {
  const body = (input ?? {}) as Record<string, unknown>
  const emailR = parseEmail(body.email)
  if (!emailR.ok) return emailR
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) return { ok: false, error: 'Enter your password.' }
  return { ok: true, value: { email: emailR.email, password } }
}
