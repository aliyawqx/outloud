import { ImportNotAvailableError, PostTooLongError, PublishError, XAuthError } from './errors'

const API = 'https://api.x.com/2'

// Characters a non-premium X account is allowed to post. Longer posts require
// X Premium; the API rejects them for free accounts.
export const X_FREE_POST_LIMIT = 280

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

/** Publish a tweet. Pass `replyToTweetId` to post it as a reply to that tweet —
 *  same endpoint/scope as a normal post, just with the reply field set. */
export async function postTweet(
  accessToken: string,
  text: string,
  replyToTweetId?: string,
): Promise<{ id: string }> {
  const payload: Record<string, unknown> = { text }
  if (replyToTweetId) payload.reply = { in_reply_to_tweet_id: replyToTweetId }
  const res = await fetch(`${API}/tweets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await readJson(res)) as { data?: { id?: string }; detail?: string; title?: string } | null
  if (!res.ok || !data?.data?.id) {
    const reason = data?.detail || data?.title || ''
    // Non-premium accounts get rejected for over-limit posts. X phrases this a few
    // ways; also treat any failure on text over the free limit as this case.
    const tooLong =
      text.length > X_FREE_POST_LIMIT &&
      (res.status === 403 || res.status === 400 || /280|character|too long|not permitted|premium/i.test(reason))
    if (tooLong) throw new PostTooLongError(X_FREE_POST_LIMIT)
    throw new PublishError(reason || 'Could not publish to X.')
  }
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
