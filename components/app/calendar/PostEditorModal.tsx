'use client'

import { useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { platformLabel, SCHEDULE_PLATFORMS, type ScheduledPost, type SchedulePlatform } from '@/lib/schedule/types'

// Edit/cancel a queued post. Published/publishing posts are read-only — the
// API enforces it too (409), this is just honest UI.

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const ALL_PLATFORMS: { key: SchedulePlatform; label: string }[] = SCHEDULE_PLATFORMS.map((p) => ({
  key: p,
  label: platformLabel(p),
}))

export function PostEditorModal({
  post,
  onClose,
  onChanged,
}: {
  post: ScheduledPost
  onClose: () => void
  onChanged: () => void
}) {
  const editable = post.status === 'scheduled' || post.status === 'draft'
  // The API also allows cancelling FAILED posts (they'd otherwise sit on the
  // calendar forever) — so cancel is offered beyond the editable statuses.
  const cancellable = editable || post.status === 'failed'
  const [content, setContent] = useState(post.content)
  const [when, setWhen] = useState(toLocalInput(post.scheduledFor))
  const [platforms, setPlatforms] = useState<SchedulePlatform[]>(post.platforms)
  const [busy, setBusy] = useState<'save' | 'cancel' | null>(null)
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  function toggle(p: SchedulePlatform) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  async function save() {
    const local = new Date(when)
    if (!content.trim()) return setError('Post text cannot be empty.')
    if (Number.isNaN(local.getTime()) || local.getTime() <= Date.now()) return setError('Pick a time in the future.')
    if (platforms.length === 0) return setError('Pick at least one platform.')
    setError('')
    setBusy('save')
    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          scheduledFor: local.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          platforms,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? 'Could not save. Try again.')
      onChanged()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function cancelPost() {
    setError('')
    setBusy('cancel')
    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? 'Could not cancel. Try again.')
      onChanged()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const auto = post.source === 'autopilot'

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit scheduled post" className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-charcoal-black/70 backdrop-blur-[4px]" />
      <div className="relative w-full max-w-lg rounded-3xl border border-border-muted bg-surface p-6 shadow-2xl">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="mb-4 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${auto ? 'bg-cyber-lime' : 'bg-electric-indigo'}`} />
          <span className="font-code-label text-code-label uppercase text-on-surface-variant">
            {auto ? 'autopilot post' : 'your post'} · {post.status}
          </span>
        </div>

        {editable ? (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-40 w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md leading-relaxed text-on-surface focus:border-electric-indigo focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                aria-label="Publish at"
                className="rounded-xl border border-border-muted bg-surface-container-lowest p-2.5 font-body-sm text-on-surface [color-scheme:dark] focus:border-electric-indigo focus:outline-none"
              />
              {ALL_PLATFORMS.map((p) => {
                const on = platforms.includes(p.key)
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(p.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-code-label text-code-label transition-colors ${
                      on ? 'border-electric-indigo bg-electric-indigo/15 text-on-surface' : 'border-border-muted text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{on ? 'check_circle' : 'radio_button_unchecked'}</span>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap rounded-xl border border-border-muted bg-surface-container-lowest p-4 font-body-md leading-relaxed text-on-surface">{post.content}</p>
            {post.status === 'published' && post.externalPostIds && (
              <div className="mt-3 flex flex-col gap-1">
                {post.externalPostIds.x && (
                  <span className="font-code-label text-code-label text-cyber-lime">published to X</span>
                )}
                {post.externalPostIds.threads && (
                  <span className="font-code-label text-code-label text-cyber-lime">published to Threads</span>
                )}
              </div>
            )}
            {post.status === 'failed' && post.error && (
              <p className="mt-3 font-body-sm text-body-sm text-error">{post.error}</p>
            )}
          </>
        )}

        {error && <p className="mt-3 font-body-sm text-body-sm text-error">{error}</p>}

        {cancellable && (
          <div className="mt-5 flex items-center gap-3">
            {editable && (
              <button
                type="button"
                onClick={save}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
              >
                {busy === 'save' ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span>}
                Save
              </button>
            )}
            {confirmCancel ? (
              <button
                type="button"
                onClick={cancelPost}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-full bg-error px-5 py-2.5 font-code-label text-code-label font-bold text-charcoal-black transition-all active:scale-95 disabled:opacity-60"
              >
                {busy === 'cancel' ? <Spinner size={16} /> : null}
                Yes, cancel it
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="rounded-full border border-border-muted px-5 py-2.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:border-error/60 hover:text-error"
              >
                Cancel post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
