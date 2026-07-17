import { getSession } from '@/lib/auth/session'
import { listNotifications, type AppNotification } from '@/lib/notifications/store'
import { MarkNotificationsRead } from '@/components/app/MarkNotificationsRead'

export const metadata = { title: 'Notifications - Outloud' }

const KIND_ICON: Record<string, string> = {
  autopilot_queued: 'auto_awesome',
  autopilot_paused: 'pause_circle',
  publish_failed: 'error',
  reconnect_needed: 'link_off',
  low_credits: 'account_balance_wallet',
  post_published: 'open_in_new',
}

// Bucket a timestamp into a human day group for the list headers.
function dayGroup(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(today) - startOfDay(d)) / 86_400_000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}

function NotifRow({ n }: { n: AppNotification }) {
  const isError = n.kind === 'publish_failed' || n.kind === 'reconnect_needed'
  const inner = (
    <>
      <span aria-hidden="true" className={`material-symbols-outlined mt-0.5 text-[20px] ${isError ? 'text-error' : 'text-electric-indigo'}`}>
        {KIND_ICON[n.kind] ?? 'info'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className={`font-body-md text-body-md text-on-surface ${n.link ? 'group-hover:underline' : ''}`}>{n.title}</span>
          <span className="shrink-0 font-code-label text-code-label text-on-surface-variant/50">
            {new Date(n.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
        {n.body && <span className="mt-0.5 block break-words font-body-sm text-body-sm text-on-surface-variant">{n.body}</span>}
      </span>
      {!n.readAt && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-electric-indigo" />}
    </>
  )
  const external = Boolean(n.link && !n.link.startsWith('/'))
  return n.link ? (
    <a href={n.link} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.04]">
      {inner}
    </a>
  ) : (
    <div className="flex items-start gap-3 rounded-xl p-3">{inner}</div>
  )
}

export default async function NotificationsPage() {
  const session = await getSession()
  if (!session) return null // layout guards auth

  const notifications = await listNotifications(session.userId, 200)

  const groups: { day: string; items: AppNotification[] }[] = []
  for (const n of notifications) {
    const day = dayGroup(n.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(n)
    else groups.push({ day, items: [n] })
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Visiting the center counts as seeing everything (same as opening the bell).
          Done client-side after mount so a router prefetch can't mark things read. */}
      <MarkNotificationsRead />
      <h1 className="mb-1 font-headline-xl text-headline-xl">Notifications</h1>
      <p className="mb-8 font-body-md text-body-md text-on-surface-variant">
        Everything that happened while you were away - autopilot runs, published posts, and anything that needs a fix.
      </p>
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-border-muted bg-surface-container-low p-8 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-on-surface-variant/40">notifications</span>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">Nothing yet - autopilot and publish updates will land here.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.day} className="mb-6">
            <h2 className="mb-1 px-3 font-code-label text-code-label uppercase tracking-wide text-on-surface-variant/60">{g.day}</h2>
            <div className="rounded-2xl border border-border-muted bg-surface-container-low p-1.5">
              {g.items.map((n) => (
                <NotifRow key={n.id} n={n} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
