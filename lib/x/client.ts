import { ImportNotAvailableError, MediaScopeError, PostTooLongError, PublishError, ReplyNotAllowedError, XAuthError } from './errors'

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
// Media still goes through the LEGACY v1.1 upload host, even with an OAuth2 user
// token — the v2 /2/tweets endpoint only accepts a media_id produced here. Requires
// the `media.write` scope; a 401/403 means the token lacks it → MediaScopeError.
const MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json'

/** Upload an image to X (v1.1 simple upload, for files <5MB) and return its
 *  media_id_string to attach when creating a tweet via POST /2/tweets. */
export async function uploadImage(accessToken: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const form = new FormData()
  form.append('media', new Blob([bytes], { type: contentType }))
  form.append('media_category', 'tweet_image')
  const res = await fetch(MEDIA_UPLOAD_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: form,
  })
  const data = (await readJson(res)) as { media_id_string?: string; errors?: Array<{ message?: string }>; error?: string } | null
  const mediaId = data?.media_id_string
  if (!res.ok || !mediaId) {
    const reason = data?.errors?.[0]?.message || data?.error || ''
    if (res.status === 401 || res.status === 403) throw new MediaScopeError()
    throw new PublishError(reason || 'Could not upload the image to X.')
  }
  return mediaId
}

/** Fetch an image (our Blob URL) and upload it to X, returning the media id. */
export async function uploadImageFromUrl(accessToken: string, url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new PublishError('Could not read the image to attach.')
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  return uploadImage(accessToken, await res.arrayBuffer(), contentType)
}

export async function postTweet(
  accessToken: string,
  text: string,
  replyToTweetId?: string,
  mediaIds?: string[],
): Promise<{ id: string }> {
  const payload: Record<string, unknown> = { text }
  if (replyToTweetId) payload.reply = { in_reply_to_tweet_id: replyToTweetId }
  if (mediaIds?.length) payload.media = { media_ids: mediaIds }
  const res = await fetch(`${API}/tweets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await readJson(res)) as { data?: { id?: string }; detail?: string; title?: string } | null
  if (!res.ok || !data?.data?.id) {
    const reason = data?.detail || data?.title || ''
    // The author restricted who can reply to this conversation — a policy block,
    // not transient. Only meaningful when we're posting a reply.
    if (replyToTweetId && /reply to this conversation is not allowed|not allowed to reply|who can reply/i.test(reason)) {
      throw new ReplyNotAllowedError()
    }
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
