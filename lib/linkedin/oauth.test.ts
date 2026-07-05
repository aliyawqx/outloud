import { describe, expect, it } from 'vitest'
import { buildAuthUrl, LINKEDIN_SCOPES } from './oauth'

describe('buildAuthUrl', () => {
  it('builds the 3-legged authorization URL per spec §2', () => {
    const url = new URL(
      buildAuthUrl({ clientId: 'cid', redirectUri: 'http://localhost:3000/api/linkedin/callback', state: 'st4te' }),
    )
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/linkedin/callback')
    expect(url.searchParams.get('state')).toBe('st4te')
    expect(url.searchParams.get('scope')).toBe(LINKEDIN_SCOPES)
  })
})
