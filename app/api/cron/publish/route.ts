import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron/auth'
import { publishScheduledPost } from '@/lib/schedule/publish'
import { claimForPublishing, finishPublish, listDuePostIds } from '@/lib/schedule/store'

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
      // Never leave a claimed row stuck in 'publishing' — requeue it as a retry.
      console.error('[cron/publish] unexpected failure:', err)
      await finishPublish(post.id, {
        status: post.retryCount < 2 ? 'scheduled' : 'failed',
        externalPostIds: post.externalPostIds ?? {},
        error: 'internal error',
        retryCount: post.retryCount + 1,
      }).catch(() => {})
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
