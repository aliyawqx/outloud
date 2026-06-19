import {
  ThreadsAuthError,
  ThreadsPostTooLongError,
  ThreadsPublishError,
  ThreadsRateLimitError,
} from './errors'

const API = 'https://graph.threads.net/v1.0'

// Threads caps a single text post at 500 characters (emojis count as their UTF-8
// byte length, but the API measures characters; we validate length before publish).
export const THREADS_TEXT_LIMIT = 500

type Json = Record<string, unknown> | null

async function readJson(res: Response): Promise<Json> {
  return (await res.json().catch(() => null)) as Json
}

function errorReason(data: Json): string {
  const e = (data as { error?: { message?: string } } | null)?.error
  return e?.message || ''
}

export async function getMe(accessToken: string): Promise<{ id: string; username: string }> {
  const u = new URL(`${API}/me`)
  u.searchParams.set('fields', 'id,username')
  u.searchParams.set('access_token', accessToken)
  let res: Response
  try {
    res = await fetch(u, { signal: AbortSignal.timeout(10_000) })
  } catch {
    throw new ThreadsAuthError()
  }
  if (!res.ok) throw new ThreadsAuthError()
  const data = (await readJson(res)) as { id?: string; username?: string } | null
  if (!data?.id) throw new ThreadsAuthError()
  // Some accounts expose no username; fall back to the id so the UI still works.
  return { id: data.id, username: data.username || data.id }
}

/** Best-effort permalink for a published media id. Returns null on any failure so
 *  publishing never fails just because we couldn't resolve the deep link. */
export async function getPermalink(accessToken: string, mediaId: string): Promise<string | null> {
  try {
    const u = new URL(`${API}/${mediaId}`)
    u.searchParams.set('fields', 'permalink')
    u.searchParams.set('access_token', accessToken)
    const res = await fetch(u)
    if (!res.ok) return null
    const data = (await readJson(res)) as { permalink?: string } | null
    return data?.permalink || null
  } catch {
    return null
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export type PublishOptions = {
  replyToId?: string
  // Public image URLs (our Blob URLs). 1 → IMAGE post, 2+ → CAROUSEL, none → TEXT.
  imageUrls?: string[]
  // Injectable for tests; defaults to real backoff delays.
  maxAttempts?: number
  sleep?: (ms: number) => Promise<void>
}

/**
 * POST a form to the Threads Graph API with exponential backoff on 429.
 * A 401 means the token is dead (revoked/expired) — not retryable, so we surface
 * it as ThreadsAuthError and let the route prompt a refresh/reconnect.
 */
async function postForm(
  path: string,
  params: Record<string, string>,
  accessToken: string,
  opts: Required<Pick<PublishOptions, 'maxAttempts' | 'sleep'>>,
): Promise<{ id: string }> {
  const body = new URLSearchParams({ ...params, access_token: accessToken })
  let lastReason = ''
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (res.ok) {
      const data = (await readJson(res)) as { id?: string } | null
      if (!data?.id) throw new ThreadsPublishError('Threads returned no id.')
      return { id: data.id }
    }
    const data = await readJson(res)
    lastReason = errorReason(data)
    if (res.status === 401) throw new ThreadsAuthError()
    if (res.status === 429) {
      // Exponential backoff: 1s, 2s, 4s, … Retry until attempts are exhausted.
      if (attempt < opts.maxAttempts - 1) {
        await opts.sleep(1000 * 2 ** attempt)
        continue
      }
      throw new ThreadsRateLimitError()
    }
    throw new ThreadsPublishError(lastReason || 'Could not publish to Threads.')
  }
  throw new ThreadsRateLimitError()
}

/**
 * Publish a text post to Threads via the two-step container model:
 *   1. POST /{user-id}/threads        → creation_id
 *   2. POST /{user-id}/threads_publish → media id
 * Pass `replyToId` to publish it as a reply (needs threads_manage_replies scope).
 * Containers go stale after ~24h, so we publish immediately after creating.
 */
export async function publishThread(
  accessToken: string,
  userId: string,
  text: string,
  options: PublishOptions = {},
): Promise<{ id: string }> {
  if (text.length > THREADS_TEXT_LIMIT) throw new ThreadsPostTooLongError(THREADS_TEXT_LIMIT)
  const opts = { maxAttempts: options.maxAttempts ?? 4, sleep: options.sleep ?? sleep }

  const imageUrls = (options.imageUrls ?? []).filter(Boolean)

  // Build the container: TEXT (no images), IMAGE (one), or CAROUSEL (2+). Threads
  // fetches each public image_url when building the container.
  let creationId: string
  if (imageUrls.length >= 2) {
    // Carousel: a child IMAGE container per photo, then a CAROUSEL parent over them.
    const childIds: string[] = []
    for (const url of imageUrls) {
      const child = await postForm(`/${userId}/threads`, { media_type: 'IMAGE', image_url: url, is_carousel_item: 'true' }, accessToken, opts)
      childIds.push(child.id)
    }
    const parent: Record<string, string> = { media_type: 'CAROUSEL', children: childIds.join(','), text }
    if (options.replyToId) parent.reply_to_id = options.replyToId
    creationId = (await postForm(`/${userId}/threads`, parent, accessToken, opts)).id
  } else {
    const params: Record<string, string> = imageUrls.length === 1
      ? { media_type: 'IMAGE', image_url: imageUrls[0], text }
      : { media_type: 'TEXT', text }
    if (options.replyToId) params.reply_to_id = options.replyToId
    creationId = (await postForm(`/${userId}/threads`, params, accessToken, opts)).id
  }

  return postForm(`/${userId}/threads_publish`, { creation_id: creationId }, accessToken, opts)
}
