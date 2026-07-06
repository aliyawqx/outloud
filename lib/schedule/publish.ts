import { publishLinkedInPost } from '@/lib/linkedin/client'
import {
  LinkedInAuthError,
  LinkedInNotConnectedError,
  LinkedInPostTooLongError,
  LinkedInRateLimitError,
  LinkedInVersionError,
} from '@/lib/linkedin/errors'
import {
  getAccount as getLinkedInAccount,
  getValidAccessToken as getLinkedInToken,
  markNeedsReconnect,
} from '@/lib/linkedin/store'
import { addNotification } from '@/lib/notifications/store'
import { getAccount as getThreadsAccount, getValidAccessToken as getThreadsToken } from '@/lib/threads/store'
import { getPermalink, publishThread } from '@/lib/threads/client'
import {
  ThreadsAuthError,
  ThreadsNotConnectedError,
  ThreadsPostTooLongError,
  ThreadsRateLimitError,
} from '@/lib/threads/errors'
import { getAccount as getXAccount, getValidAccessToken as getXToken } from '@/lib/x/store'
import { postTweet, uploadImageFromUrl } from '@/lib/x/client'
import { X_MEDIA_SCOPE_ENABLED } from '@/lib/x/oauth'
import { MediaScopeError, PostTooLongError, ReplyNotAllowedError, XAuthError, XNotConnectedError } from '@/lib/x/errors'
import { finishPublish, type PublishOutcome } from './store'
import type { ExternalPostIds, ScheduledPost, SchedulePlatform } from './types'

// The publish executor. Deliberately callable for ONE post so the cron scan can
// be swapped for per-post QStash callbacks later without touching this logic
// (spec §6 upgrade path). The caller must have CLAIMED the post already
// (status='publishing' via claimForPublishing) — this function only publishes
// and records the outcome.

export type AttemptResult = {
  platform: SchedulePlatform
  ok: boolean
  id?: string
  error?: string
  /** true = worth retrying (rate limit, 5xx, network); false = terminal
   *  (disconnected, expired auth, too long) — retrying can't fix it. */
  transient?: boolean
  /** 429s get special treatment (spec §6): defer instead of burning a retry. */
  rateLimited?: boolean
  /** Live link to the created post (addendum B): X/LinkedIn constructed, Threads fetched. */
  permalink?: string
}

/** Pure outcome policy (spec §6b.4-5): retry transient failures up to 2 times,
 *  keep per-platform successes, never fail a post that reached ANY platform. */
export function decideOutcome(
  retryCount: number,
  results: AttemptResult[],
  prior: ExternalPostIds,
  priorPermalinks: Partial<Record<SchedulePlatform, string>> = {},
): PublishOutcome {
  const ids: ExternalPostIds = { ...prior }
  const permalinks: Partial<Record<SchedulePlatform, string>> = { ...priorPermalinks }
  const errors: string[] = []
  let transient = false
  for (const r of results) {
    if (r.ok && r.id) {
      ids[r.platform] = r.id
      if (r.permalink) permalinks[r.platform] = r.permalink
    } else if (!r.ok) {
      errors.push(`${r.platform}: ${r.error ?? 'failed'}`)
      if (r.transient) transient = true
    }
  }
  const error = errors.length ? errors.join(' | ') : null
  const failures = results.filter((r) => !r.ok)
  const onlyRateLimited = failures.length > 0 && failures.every((r) => r.rateLimited)
  if (onlyRateLimited) {
    // 429s never fail a post and never burn retries — back off one cycle (spec §6).
    return { status: 'scheduled', externalPostIds: ids, permalinks, error, retryCount, deferMinutes: 60 }
  }
  if (transient && retryCount < 2) {
    return { status: 'scheduled', externalPostIds: ids, permalinks, error, retryCount: retryCount + 1 }
  }
  if (Object.keys(ids).length > 0) {
    return { status: 'published', externalPostIds: ids, permalinks, error, retryCount }
  }
  return { status: 'failed', externalPostIds: ids, permalinks, error: error ?? 'publish failed', retryCount }
}

async function publishToX(post: ScheduledPost): Promise<AttemptResult> {
  try {
    const token = await getXToken(post.userId)
    let mediaIds: string[] | undefined
    const urls = (post.media ?? []).map((m) => m.url).slice(0, 4)
    if (urls.length && X_MEDIA_SCOPE_ENABLED) {
      mediaIds = []
      for (const url of urls) mediaIds.push(await uploadImageFromUrl(token, url))
    }
    const { id } = await postTweet(token, post.content, undefined, mediaIds)
    // Link-in-first-reply: best-effort — a failed reply never fails the post.
    if (post.firstReply?.trim()) {
      await postTweet(token, post.firstReply.trim(), id).catch((e) =>
        console.error('[schedule/publish] first reply failed:', e),
      )
    }
    const account = await getXAccount(post.userId).catch(() => null)
    const permalink = account
      ? `https://x.com/${account.username}/status/${id}`
      : `https://x.com/i/status/${id}`
    return { platform: 'x', ok: true, id, permalink }
  } catch (err) {
    if (err instanceof XNotConnectedError) return { platform: 'x', ok: false, error: 'X not connected', transient: false }
    if (err instanceof XAuthError) return { platform: 'x', ok: false, error: 'X connection expired — reconnect in Profile', transient: false }
    if (err instanceof MediaScopeError) return { platform: 'x', ok: false, error: 'X media permission missing — reconnect in Profile', transient: false }
    if (err instanceof PostTooLongError) return { platform: 'x', ok: false, error: `too long for X (limit ${err.limit})`, transient: false }
    if (err instanceof ReplyNotAllowedError) return { platform: 'x', ok: false, error: err.message, transient: false }
    console.error('[schedule/publish] X failed:', err)
    return { platform: 'x', ok: false, error: 'X publish failed', transient: true }
  }
}

async function publishToThreads(post: ScheduledPost): Promise<AttemptResult> {
  try {
    const token = await getThreadsToken(post.userId)
    const account = await getThreadsAccount(post.userId)
    if (!account) throw new ThreadsNotConnectedError()
    const imageUrls = (post.media ?? []).map((m) => m.url)
    const { id } = await publishThread(token, account.threadsUserId, post.content, { imageUrls })
    // Threads permalink is FETCHED off the media object, never constructed (addendum B).
    const permalink = await getPermalink(token, id).catch(() => null)
    return { platform: 'threads', ok: true, id, ...(permalink ? { permalink } : {}) }
  } catch (err) {
    if (err instanceof ThreadsNotConnectedError) return { platform: 'threads', ok: false, error: 'Threads not connected', transient: false }
    if (err instanceof ThreadsAuthError) return { platform: 'threads', ok: false, error: 'Threads connection expired — reconnect in Profile', transient: false }
    if (err instanceof ThreadsPostTooLongError) return { platform: 'threads', ok: false, error: `too long for Threads (limit ${err.limit})`, transient: false }
    if (err instanceof ThreadsRateLimitError) return { platform: 'threads', ok: false, error: 'Threads rate limit', transient: true }
    console.error('[schedule/publish] Threads failed:', err)
    return { platform: 'threads', ok: false, error: 'Threads publish failed', transient: true }
  }
}

async function publishToLinkedIn(post: ScheduledPost): Promise<AttemptResult> {
  try {
    const token = await getLinkedInToken(post.userId)
    const account = await getLinkedInAccount(post.userId)
    if (!account) throw new LinkedInNotConnectedError()
    // No first_reply chaining here — link-in-first-reply is an X reach
    // workaround; on LinkedIn links belong in the body (spec §8).
    const urls = (post.media ?? []).map((m) => m.url)
    const alts = (post.media ?? []).map((m) => m.alt ?? '')
    const { id } = await publishLinkedInPost(token, account.personUrn, post.content, {
      imageUrls: urls,
      imageAlts: alts,
    })
    // id IS the urn from the x-restli-id header → the public update URL.
    return { platform: 'linkedin', ok: true, id, permalink: `https://www.linkedin.com/feed/update/${id}/` }
  } catch (err) {
    if (err instanceof LinkedInNotConnectedError) {
      return { platform: 'linkedin', ok: false, error: 'LinkedIn not connected', transient: false }
    }
    if (err instanceof LinkedInAuthError) {
      // Dead token: flag reconnect + tell the user; NEVER burn retries on it (spec §5).
      await markNeedsReconnect(post.userId).catch(() => {})
      await addNotification({
        userId: post.userId,
        kind: 'reconnect_needed',
        title: 'reconnect linkedin',
        body: 'your linkedin connection expired — reconnect in profile to keep posting.',
        refId: post.id,
      }).catch((e) => console.error('[schedule/publish] notify failed:', e))
      return { platform: 'linkedin', ok: false, error: 'linkedin_needs_reconnect', transient: false }
    }
    if (err instanceof LinkedInPostTooLongError) {
      return { platform: 'linkedin', ok: false, error: `too long for LinkedIn (limit ${err.limit})`, transient: false }
    }
    if (err instanceof LinkedInRateLimitError) {
      return { platform: 'linkedin', ok: false, error: 'LinkedIn rate limit', transient: true, rateLimited: true }
    }
    if (err instanceof LinkedInVersionError) {
      console.error('[schedule/publish] LinkedIn version rejected — bump LINKEDIN_API_VERSION')
      return { platform: 'linkedin', ok: false, error: 'linkedin api version outdated', transient: false }
    }
    console.error('[schedule/publish] LinkedIn failed:', err)
    return { platform: 'linkedin', ok: false, error: 'LinkedIn publish failed', transient: true }
  }
}

/** Publish ONE already-claimed post. Skips platforms that succeeded on an
 *  earlier attempt (their ids are in externalPostIds). Records the outcome and
 *  notifies on terminal failure. Returns the resulting status. */
export async function publishScheduledPost(post: ScheduledPost): Promise<'published' | 'scheduled' | 'failed'> {
  const prior = post.externalPostIds ?? {}
  const results: AttemptResult[] = []
  for (const platform of post.platforms) {
    if (prior[platform]) continue
    if (platform === 'x') results.push(await publishToX(post))
    else if (platform === 'threads') results.push(await publishToThreads(post))
    else results.push(await publishToLinkedIn(post))
  }
  const outcome = decideOutcome(post.retryCount, results, prior, post.permalinks ?? {})
  await finishPublish(post.id, outcome)
  if (outcome.status === 'failed') {
    await addNotification({
      userId: post.userId,
      kind: 'publish_failed',
      title: 'a scheduled post failed to publish',
      body: 'open the calendar to see what happened and try again.',
      refId: post.id,
    }).catch((e) => console.error('[schedule/publish] notify failed:', e))
  }
  return outcome.status
}
