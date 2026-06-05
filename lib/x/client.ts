import { ImportNotAvailableError, PublishError, XAuthError } from './errors'

const API = 'https://api.x.com/2'

type Json = Record<string, unknown> | null

async function readJson(res: Response): Promise<Json> {
  return (await res.json().catch(() => null)) as Json
}

export async function getMe(accessToken: string): Promise<{ id: string; username: string }> {
  const res = await fetch(`${API}/users/me`, { headers: { authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new XAuthError()
  const data = (await readJson(res)) as { data?: { id?: string; username?: string } } | null
  if (!data?.data?.id || !data.data.username) throw new XAuthError()
  return { id: data.data.id, username: data.data.username }
}

export async function postTweet(accessToken: string, text: string): Promise<{ id: string }> {
  const res = await fetch(`${API}/tweets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = (await readJson(res)) as { data?: { id?: string }; detail?: string; title?: string } | null
  if (!res.ok || !data?.data?.id) throw new PublishError(data?.detail || data?.title || 'Could not publish to X.')
  return { id: data.data.id }
}

/** The user's own recent ORIGINAL posts (no retweets/replies), as plain text. */
export async function fetchOriginalTweets(accessToken: string, xUserId: string, max: number): Promise<string[]> {
  const u = new URL(`${API}/users/${xUserId}/tweets`)
  u.searchParams.set('max_results', String(Math.min(100, Math.max(5, max))))
  u.searchParams.set('exclude', 'retweets,replies')
  u.searchParams.set('tweet.fields', 'text,note_tweet')
  const res = await fetch(u, { headers: { authorization: `Bearer ${accessToken}` } })
  if (res.status === 403) throw new ImportNotAvailableError()
  if (!res.ok) throw new XAuthError()
  const data = (await readJson(res)) as { data?: Array<{ text?: string; note_tweet?: { text?: string } }> } | null
  const arr = Array.isArray(data?.data) ? data!.data! : []
  return arr.map((t) => (t.note_tweet?.text || t.text || '').trim()).filter(Boolean)
}
