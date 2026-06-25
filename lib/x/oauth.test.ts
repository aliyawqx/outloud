import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { base64url, buildAuthUrl, exchangeCode, makePkce, makeState, refreshToken, X_SCOPES } from './oauth'

afterEach(() => vi.unstubAllGlobals())

describe('pkce', () => {
  it('derives a valid S256 challenge from the verifier', () => {
    const { verifier, challenge } = makePkce()
    const expected = base64url(createHash('sha256').update(verifier).digest())
    expect(challenge).toBe(expected)
    expect(verifier).not.toContain('=')
    expect(challenge).not.toContain('=')
  })

  it('makeState is URL-safe and non-empty', () => {
    expect(makeState()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('buildAuthUrl', () => {
  it('includes all required authorize params', () => {
    const url = new URL(
      buildAuthUrl({ clientId: 'cid', redirectUri: 'https://app/cb', state: 'st', challenge: 'ch' }),
    )
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/cb')
    expect(url.searchParams.get('scope')).toBe(X_SCOPES)
    expect(url.searchParams.get('state')).toBe('st')
    expect(url.searchParams.get('code_challenge')).toBe('ch')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })
})

describe('exchangeCode', () => {
  it('POSTs the authorization_code grant with Basic auth and returns tokens', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init: RequestInit) => new Response(
      JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 7200, scope: X_SCOPES, token_type: 'bearer' }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const tok = await exchangeCode({ code: 'c', verifier: 'v', clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://app/cb' })
    expect(tok.access_token).toBe('at')

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>).authorization).toBe('Basic ' + Buffer.from('cid:sec').toString('base64'))
    const body = (init.body as URLSearchParams)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('c')
    expect(body.get('code_verifier')).toBe('v')
  })

  it('throws XAuthError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
    await expect(exchangeCode({ code: 'c', verifier: 'v', clientId: 'cid', clientSecret: 'sec', redirectUri: 'r' })).rejects.toThrow(/token request failed/)
  })
})

describe('refreshToken', () => {
  it('POSTs the refresh_token grant', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init: RequestInit) => new Response(
      JSON.stringify({ access_token: 'at2', refresh_token: 'rt2', expires_in: 7200, scope: X_SCOPES, token_type: 'bearer' }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const tok = await refreshToken({ refreshToken: 'rt', clientId: 'cid', clientSecret: 'sec' })
    expect(tok.access_token).toBe('at2')
    expect((fetchMock.mock.calls[0][1].body as URLSearchParams).get('grant_type')).toBe('refresh_token')
  })
})
