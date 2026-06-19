// Centralized X OAuth env access. Throws if the operator has not pasted keys.

export type XConfig = { clientId: string; clientSecret: string; redirectUri: string }

export function xConfig(): XConfig {
  // .trim() defends against stray whitespace/newlines in the env values — a trailing
  // "\n" in X_REDIRECT_URI silently broke OAuth (redirect_uri mismatch at consent).
  const clientId = process.env.X_CLIENT_ID?.trim()
  const clientSecret = process.env.X_CLIENT_SECRET?.trim()
  const redirectUri = process.env.X_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('X OAuth is not configured (set X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI).')
  }
  return { clientId, clientSecret, redirectUri }
}
