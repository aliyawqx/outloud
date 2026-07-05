import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron/auth'
import { addNotification } from '@/lib/notifications/store'
import { publishScheduledPost } from '@/lib/schedule/publish'
import { claimForPublishing, listDuePostIds, recordInternalPublishError } from '@/lib/schedule/store'

// Publish cron (spec §6b): scan due posts, claim each atomically, publish.
// Triggered externally (cron-job.org / GitHub Actions) every 1-5 minutes —
// Vercel Hobby crons only run daily, so no vercel.json here.
export const maxDuration = 60

const BATCH_LIMIT = 10

async function run(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const due = await listDuePostIds(BATCH_LIMIT)
  let published = 0
  let requeued = 0
  let failed = 0
  let skipped = 0

  for (const id of due) {
    // Atomic claim: a concurrent run gets null here and skips — no double-publish.
    const post = await claimForPublishing(id)
    if (!post) {
      skipped++
      continue
    }
    try {
      const status = await publishScheduledPost(post)
      if (status === 'published') published++
      else if (status === 'scheduled') requeued++
      else failed++
    } catch (err) {
      // Never leave a claimed row stuck in 'publishing' — requeue it as a retry,
      // or fail it terminally WITH the user notification (never silently).
      console.error('[cron/publish] unexpected failure:', err)
      const terminal = post.retryCount >= 2
      await recordInternalPublishError(post.id, {
        status: terminal ? 'failed' : 'scheduled',
        retryCount: terminal ? post.retryCount : post.retryCount + 1,
      }).catch(() => {})
      if (terminal) {
        await addNotification({
          userId: post.userId,
          kind: 'publish_failed',
          title: 'a scheduled post failed to publish',
          body: 'open the calendar to see what happened and try again.',
          refId: post.id,
        }).catch(() => {})
      }
      failed++
    }
  }

  return NextResponse.json({ due: due.length, published, requeued, failed, skipped })
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
