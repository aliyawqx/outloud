// Centralized Threads (Meta) OAuth env access. Throws if the operator has not
// pasted keys. Mirrors lib/x/config.ts. Meta calls these the App ID / App Secret;
// the OAuth endpoints take them as client_id / client_secret.

export type ThreadsConfig = { clientId: string; clientSecret: string; redirectUri: string }

export function threadsConfig(): ThreadsConfig {
  const clientId = process.env.THREADS_APP_ID
  const clientSecret = process.env.THREADS_APP_SECRET
  const redirectUri = process.env.THREADS_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Threads OAuth is not configured (set THREADS_APP_ID, THREADS_APP_SECRET, THREADS_REDIRECT_URI).')
  }
  return { clientId, clientSecret, redirectUri }
}
