// LinkedIn app credentials + the pinned Posts API version month.
// .trim() everything — a trailing newline in an env var broke X OAuth once.
const DEFAULT_LINKEDIN_VERSION = '202506'

export function linkedinConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = (process.env.LINKEDIN_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET ?? '').trim()
  const redirectUri = (process.env.LINKEDIN_REDIRECT_URI ?? '').trim()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_REDIRECT_URI are not set')
  }
  return { clientId, clientSecret, redirectUri }
}

/** The LinkedIn-Version header month (YYYYMM). LinkedIn versions monthly and
 *  supports each ~12 months — bumping this is deliberately a one-line change. */
export function linkedinVersion(): string {
  return (process.env.LINKEDIN_API_VERSION ?? '').trim() || DEFAULT_LINKEDIN_VERSION
}
