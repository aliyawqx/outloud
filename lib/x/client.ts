import { ImportNotAvailableError, MediaScopeError, PostTooLongError, PublishError, ReplyNotAllowedError, XAuthError } from './errors'

const API = 'https://api.x.com/2'

// Characters a non-premium X account is allowed to post. Longer posts require
// X Premium; the API rejects them for free accounts.
export const X_FREE_POST_LIMIT = 280
// Premium (verified) accounts can post long-form up to 25k characters.
export const X_PREMIUM_POST_LIMIT = 25_000

type Json = Record<string, unknown> | null

async function readJson(res: Response): Promise<Json> {
  return (await res.json().catch(() => null)) as Json
}

export async function getMe(accessToken: string): Promise<{ id: string; username: string; verifiedType: string | null }> {
  // verified_type ('blue' | 'business' | 'government' | 'none') is the premium
  // signal: any value but 'none' unlocks long-form posts (see store.ts premium).
  const res = await fetch(`${API}/users/me?user.fields=verified_type`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new XAuthError()
  const data = (await readJson(res)) as { data?: { id?: string; username?: string; verified_type?: string } } | null
  if (!data?.data?.id || !data.data.username) throw new XAuthError()
  return { id: data.data.id, username: data.data.username, verifiedType: data.data.verified_type ?? null }
}

/** Publish a tweet. Pass `replyToTweetId` to post it as a reply to that tweet —
 *  same endpoint/scope as a normal post, just with the reply field set. */
// v2 media upload is a 3-step flow on api.x.com (the old single-shot v1.1 host does
// NOT accept OAuth2 tokens — it 403s): initialize → append chunk(s) → finalize. The
// resulting media id goes into POST /2/tweets. Needs the `media.write` scope; a
// 401/403 on initialize means the token lacks it → MediaScopeError. Images are well
// under 5MB so a single append segment is enough.
const MEDIA_BASE = 'https://api.x.com/2/media/upload'

export async function uploadImage(accessToken: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const auth = { authorization: `Bearer ${accessToken}` }

  // 1) initialize — JSON metadata, returns the media id.
  const initRes = await fetch(`${MEDIA_BASE}/initialize`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ media_type: contentType, total_bytes: bytes.byteLength, media_category: 'tweet_image' }),
  })
  const initData = (await readJson(initRes)) as { data?: { id?: string } } | null
  const mediaId = initData?.data?.id
  if (!initRes.ok || !mediaId) {
    if (initRes.status === 401 || initRes.status === 403) throw new MediaScopeError()
    throw new PublishError('Could not start the image upload to X.')
  }

  // 2) append — the image bytes as a single segment (multipart/form-data).
  const form = new FormData()
  form.append('media', new Blob([bytes], { type: contentType }))
  form.append('segment_index', '0')
  const appendRes = await fetch(`${MEDIA_BASE}/${mediaId}/append`, { method: 'POST', headers: auth, body: form })
  if (!appendRes.ok) throw new PublishError('Could not upload the image to X.')

  // 3) finalize — makes the media usable; for images it's ready immediately.
  const finalizeRes = await fetch(`${MEDIA_BASE}/${mediaId}/finalize`, { method: 'POST', headers: auth })
  if (!finalizeRes.ok) throw new PublishError('Could not finalize the image upload to X.')

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
  // The account's real cap (premium accounts post long-form) — drives only the
  // too-long failure classification below, the API enforces the actual limit.
  limit: number = X_FREE_POST_LIMIT,
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
    // Accounts get rejected for over-limit posts. X phrases this a few ways;
    // also treat any failure on text over the account's limit as this case.
    const tooLong =
      text.length > limit &&
      (res.status === 403 || res.status === 400 || /280|character|too long|not permitted|premium/i.test(reason))
    if (tooLong) throw new PostTooLongError(limit)
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
