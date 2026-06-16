import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildAuthUrl, exchangeCode, exchangeLongLived, refreshLongLived, THREADS_SCOPES } from './oauth'

afterEach(() => vi.unstubAllGlobals())

describe('buildAuthUrl', () => {
  it('includes client_id, redirect_uri, scope, response_type and state', () => {
    const url = new URL(buildAuthUrl({ clientId: 'cid', redirectUri: 'https://app/cb', state: 'st' }))
    expect(url.origin + url.pathname).toBe('https://threads.net/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/cb')
    expect(url.searchParams.get('scope')).toBe(THREADS_SCOPES)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('st')
  })

  it('requests the reply-publishing scope', () => {
    expect(THREADS_SCOPES).toContain('threads_manage_replies')
    expect(THREADS_SCOPES).toContain('threads_content_publish')
  })
})

describe('exchangeCode', () => {
  it('POSTs the auth code and returns access_token + stringified user_id', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init: RequestInit) =>
      new Response(JSON.stringify({ access_token: 'short', user_id: 17841405 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await exchangeCode({ code: 'abc#_', clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://app/cb' })).toEqual({
      access_token: 'short',
      user_id: '17841405',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://graph.threads.net/oauth/access_token')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('client_secret')).toBe('sec')
    expect(body.get('code')).toBe('abc') // trailing "#_" stripped
  })

  it('throws ThreadsAuthError on a bad response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
    await expect(exchangeCode({ code: 'x', clientId: 'c', clientSecret: 's', redirectUri: 'r' })).rejects.toMatchObject({
      name: 'ThreadsAuthError',
    })
  })
})

describe('exchangeLongLived', () => {
  it('GETs access_token with grant_type=th_exchange_token', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) =>
      new Response(JSON.stringify({ access_token: 'long', token_type: 'bearer', expires_in: 5184000 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const tok = await exchangeLongLived({ shortToken: 'short', clientSecret: 'sec' })
    expect(tok).toEqual({ access_token: 'long', token_type: 'bearer', expires_in: 5184000 })
    const u = new URL(String(fetchMock.mock.calls[0][0]))
    expect(u.origin + u.pathname).toBe('https://graph.threads.net/access_token')
    expect(u.searchParams.get('grant_type')).toBe('th_exchange_token')
    expect(u.searchParams.get('client_secret')).toBe('sec')
    expect(u.searchParams.get('access_token')).toBe('short')
  })
})

describe('refreshLongLived', () => {
  it('GETs refresh_access_token with grant_type=th_refresh_token', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) =>
      new Response(JSON.stringify({ access_token: 'long2', expires_in: 5184000 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const tok = await refreshLongLived({ longToken: 'long' })
    expect(tok.access_token).toBe('long2')
    const u = new URL(String(fetchMock.mock.calls[0][0]))
    expect(u.origin + u.pathname).toBe('https://graph.threads.net/refresh_access_token')
    expect(u.searchParams.get('grant_type')).toBe('th_refresh_token')
    expect(u.searchParams.get('access_token')).toBe('long')
  })
})
