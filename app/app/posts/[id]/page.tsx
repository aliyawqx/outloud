import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getScheduledPost } from '@/lib/schedule/store'
import { platformLabel, SCHEDULE_PLATFORMS } from '@/lib/schedule/types'
import { PlatformGlyph } from '@/components/app/PlatformGlyph'

export const metadata = { title: 'Post - Outloud' }

// The tap-through target for "your post is live" notifications: the post itself
// plus one icon per platform it went out on, each linking to the live post there.
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/signup')
  // A malformed id makes Postgres reject the uuid cast - same answer as "not yours".
  const post = await getScheduledPost(session.userId, id).catch(() => null)
  if (!post) notFound()

  const live = SCHEDULE_PLATFORMS.filter((p) => post.platforms.includes(p) && post.externalPostIds?.[p])
  const when = post.publishedAt ?? post.scheduledFor

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href="/app/calendar"
        className="mb-6 inline-flex items-center gap-1 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_back</span>
        Calendar
      </Link>

      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg">{post.status === 'published' ? 'Your post is live' : 'Your post'}</h1>
        <p className="mt-1 font-code-label text-code-label uppercase text-on-surface-variant">
          {post.source === 'autopilot' ? 'autopilot post' : 'your post'} · {post.status} ·{' '}
          {new Date(when).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <p className="whitespace-pre-wrap rounded-2xl border border-border-muted bg-surface-container-lowest p-5 font-body-md leading-relaxed text-on-surface">
        {post.content}
      </p>

      {post.media && post.media.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {post.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.url} src={m.url} alt={m.alt ?? ''} className="h-28 w-28 rounded-xl border border-border-muted object-cover" />
          ))}
        </div>
      )}

      {live.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 font-code-label text-code-label text-on-surface-variant">Open it where it published:</p>
          <div className="flex items-center gap-3">
            {live.map((p) => {
              const url = post.permalinks?.[p]
              const inner = (
                <>
                  <PlatformGlyph platform={p} className="h-5 w-5" />
                  <span className="sr-only">{platformLabel(p)}</span>
                </>
              )
              // A permalink opens the live post; without one (older posts) the
              // icon still confirms the platform, just not clickable.
              return url ? (
                <a
                  key={p}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open on ${platformLabel(p)}`}
                  title={`Open on ${platformLabel(p)}`}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-border-muted bg-surface-container text-on-surface transition-colors hover:border-electric-indigo hover:text-electric-indigo"
                >
                  {inner}
                </a>
              ) : (
                <span
                  key={p}
                  title={`Published to ${platformLabel(p)}`}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-border-muted bg-surface-container text-on-surface-variant/60"
                >
                  {inner}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {post.error && (
        <p className="mt-6 rounded-xl border border-error/30 bg-error/10 p-4 font-body-sm text-body-sm text-error">
          {post.error}
        </p>
      )}
    </div>
  )
}
