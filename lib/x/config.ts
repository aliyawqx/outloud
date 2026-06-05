// Centralized X OAuth env access. Throws if the operator has not pasted keys.

export type XConfig = { clientId: string; clientSecret: string; redirectUri: string }

export function xConfig(): XConfig {
  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  const redirectUri = process.env.X_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('X OAuth is not configured (set X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI).')
  }
  return { clientId, clientSecret, redirectUri }
}
