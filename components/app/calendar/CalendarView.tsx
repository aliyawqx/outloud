'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { platformShort, type ScheduledPost, type SchedulePlatform } from '@/lib/schedule/types'
import { PostEditorModal } from './PostEditorModal'

// ONE calendar, two sources: manual (violet) and autopilot (lime). Month and
// week views over the same GET /api/scheduled-posts range read.

type ViewMode = 'month' | 'week'

const DAY_MS = 86_400_000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Local-midnight Date for "today". All grid math is in the BROWSER's zone -
 *  the calendar shows times as the user's device sees them. */
function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // Monday start
  return x
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'scheduled', cls: 'border-border-muted text-on-surface-variant' },
  publishing: { label: 'publishing', cls: 'border-electric-indigo/60 text-electric-indigo' },
  published: { label: 'published', cls: 'border-cyber-lime/60 text-cyber-lime' },
  failed: { label: 'failed', cls: 'border-error/60 text-error' },
  draft: { label: 'draft', cls: 'border-border-muted text-on-surface-variant' },
}

function PlatformIcons({ platforms }: { platforms: string[] }) {
  return (
    <span className="font-code-label text-[10px] uppercase text-on-surface-variant/70">
      {platforms.map((p) => platformShort(p as SchedulePlatform)).join('·')}
    </span>
  )
}

function PostChip({ post, onClick }: { post: ScheduledPost; onClick: () => void }) {
  const auto = post.source === 'autopilot'
  return (
    <button
      type="button"
      onClick={onClick}
      title={post.content}
      className={`flex w-full items-center gap-1.5 truncate rounded-lg border px-1.5 py-1 text-left font-code-label text-[11px] transition-colors ${
        auto
          ? 'border-cyber-lime/40 bg-cyber-lime/10 text-on-surface hover:bg-cyber-lime/20'
          : 'border-electric-indigo/40 bg-electric-indigo/10 text-on-surface hover:bg-electric-indigo/20'
      } ${post.status === 'failed' ? 'border-error/60' : ''}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${auto ? 'bg-cyber-lime' : 'bg-electric-indigo'}`} />
      <span className="shrink-0">
        {new Date(post.scheduledFor).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="truncate text-on-surface-variant">{post.content}</span>
    </button>
  )
}

export function CalendarView() {
  const [view, setView] = useState<ViewMode>('month')
  // Anchor: first of the shown month, or the Monday of the shown week.
  const [anchor, setAnchor] = useState(() => new Date())
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ScheduledPost | null>(null)

  const range = useMemo(() => {
    if (view === 'week') {
      const from = startOfWeek(anchor)
      return { from, to: new Date(from.getTime() + 7 * DAY_MS) }
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const gridStart = startOfWeek(first)
    return { from: gridStart, to: new Date(gridStart.getTime() + 42 * DAY_MS) }
  }, [anchor, view])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = `from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      const res = await fetch(`/api/scheduled-posts?${qs}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not load the calendar.')
        return
      }
      setPosts(data.posts ?? [])
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>()
    for (const p of posts) {
      const key = dayKey(new Date(p.scheduledFor))
      map.set(key, [...(map.get(key) ?? []), p])
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    return map
  }, [posts])

  function move(dir: -1 | 1) {
    setAnchor((a) =>
      view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : new Date(a.getTime() + dir * 7 * DAY_MS),
    )
  }

  const todayKey = dayKey(new Date())
  const title =
    view === 'month'
      ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `Week of ${startOfWeek(anchor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  const days = useMemo(() => {
    const count = view === 'month' ? 42 : 7
    const start = view === 'month' ? startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) : startOfWeek(anchor)
    return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * DAY_MS))
  }, [anchor, view])

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous" onClick={() => move(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <button type="button" aria-label="Next" onClick={() => move(1)} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
          <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 rounded-full border border-border-muted px-3 py-1.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface">
            Today
          </button>
        </div>
        <h2 className="font-body-md text-body-md font-bold text-on-surface">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          {(['month', 'week'] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={view === m}
              onClick={() => setView(m)}
              className={`rounded-full border px-3 py-1.5 font-code-label text-code-label capitalize transition-colors ${
                view === m ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface' : 'border-border-muted text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 font-code-label text-code-label text-on-surface-variant/70">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-electric-indigo" /> you</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyber-lime" /> autopilot</span>
        {loading && <Spinner size={14} />}
      </div>

      {error && <p className="mb-3 font-body-sm text-body-sm text-error">{error}</p>}

      {view === 'month' ? (
        <div className="overflow-hidden rounded-2xl border border-border-muted">
          <div className="grid grid-cols-7 border-b border-border-muted bg-surface-container-lowest">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2 text-center font-code-label text-code-label uppercase text-on-surface-variant/60">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = d.getMonth() === anchor.getMonth()
              const key = dayKey(d)
              const dayPosts = byDay.get(key) ?? []
              return (
                <div key={key} className={`min-h-24 border-b border-r border-border-muted p-1.5 last:border-r-0 ${inMonth ? '' : 'bg-surface-container-lowest/50 opacity-50'}`}>
                  <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full font-code-label text-[11px] ${key === todayKey ? 'bg-electric-indigo text-white' : 'text-on-surface-variant'}`}>
                    {d.getDate()}
                  </span>
                  <div className="flex flex-col gap-1">
                    {dayPosts.slice(0, 3).map((p) => <PostChip key={p.id} post={p} onClick={() => setEditing(p)} />)}
                    {dayPosts.length > 3 && (
                      <span className="px-1.5 font-code-label text-[10px] text-on-surface-variant/60">+{dayPosts.length - 3} more</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {days.map((d) => {
            const key = dayKey(d)
            const dayPosts = byDay.get(key) ?? []
            return (
              <div key={key} className="rounded-2xl border border-border-muted bg-surface-container-low p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`font-body-md text-body-md font-bold ${key === todayKey ? 'text-electric-indigo' : 'text-on-surface'}`}>
                    {d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {dayPosts.length === 0 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant/50">nothing queued</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayPosts.map((p) => {
                      const auto = p.source === 'autopilot'
                      const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.scheduled
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setEditing(p)}
                          className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                            auto ? 'border-cyber-lime/30 hover:border-cyber-lime/60' : 'border-electric-indigo/30 hover:border-electric-indigo/60'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${auto ? 'bg-cyber-lime' : 'bg-electric-indigo'}`} />
                            <span className="font-code-label text-code-label text-on-surface">
                              {new Date(p.scheduledFor).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <PlatformIcons platforms={p.platforms} />
                            <span className={`ml-auto rounded-full border px-2 py-0.5 font-code-label text-[10px] uppercase ${badge.cls}`}>{badge.label}</span>
                          </span>
                          <span className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{p.content}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <PostEditorModal
          post={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
