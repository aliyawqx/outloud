'use client'

import { useMemo, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import type { AutopilotSettings } from '@/lib/autopilot/store'
import { matchTopics } from '@/lib/autopilot/topics'
import { deviceTimezone, timezoneOptions } from '@/lib/timezones'
import type { PostingTime } from '@/lib/schedule/slots'
import { estimateMonthlyCredits } from '@/lib/autopilot/estimate'
import { fmtCredits } from '@/lib/creditsConfig'
import { platformLabel, SCHEDULE_PLATFORMS, type ScheduledPost, type SchedulePlatform } from '@/lib/schedule/types'
import { PlatformGlyph } from '@/components/app/PlatformGlyph'
import { X_FREE_POST_LIMIT } from '@/lib/x/client'

const DAY_LABELS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-electric-indigo' : 'bg-surface-container-highest'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function AutopilotSettingsPanel({
  initial,
  upcoming,
  xConnected,
  xPremium,
  threadsConnected,
  linkedInConnected,
  monthlyAllowance = null,
}: {
  initial: AutopilotSettings
  upcoming: ScheduledPost[]
  xConnected: boolean
  xPremium: boolean
  threadsConnected: boolean
  linkedInConnected: boolean
  /** Plan credits refilled per month; null = unlimited (staff). Caps the schedule. */
  monthlyAllowance?: number | null
}) {
  const [s, setS] = useState(initial)
  const [interestDraft, setInterestDraft] = useState('')
  const [busy, setBusy] = useState<'save' | 'pause' | 'resume' | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  // The master tumbler persists ITSELF (no Save needed). When the user flips it
  // on before adding a topic/time, we expand the details and hold the intent in
  // pendingOn - the next Save turns autopilot on together with the essentials.
  const [pendingOn, setPendingOn] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [enableHint, setEnableHint] = useState('')
  const tzOptions = useMemo(() => timezoneOptions(), [])
  const deviceTz = useMemo(() => deviceTimezone(), [])
  const expanded = s.enabled || pendingOn

  const connected: Record<SchedulePlatform, boolean> = {
    x: xConnected,
    threads: threadsConnected,
    linkedin: linkedInConnected,
  }
  const pausedForCredits = s.pausedAt && s.pauseReason === 'insufficient_credits'

  // Live burn projection - mirrors the server-side cap in PUT /api/autopilot.
  const estimate = estimateMonthlyCredits(s.postingTimes, s.aiImages)
  const overBudget = monthlyAllowance != null && estimate.creditsPerMonth > monthlyAllowance
  // Would ONE more every-day slot still fit? Gates the "+ Add time" button.
  const nextSlotFits =
    monthlyAllowance == null ||
    estimateMonthlyCredits([...s.postingTimes, { time: '09:00' }], s.aiImages).creditsPerMonth <= monthlyAllowance

  function patch(p: Partial<AutopilotSettings>) {
    setSaved(false)
    setS((cur) => ({ ...cur, ...p }))
  }

  function addInterest() {
    const v = interestDraft.trim()
    if (!v) return
    if (!s.interests.includes(v)) patch({ interests: [...s.interests, v] })
    setInterestDraft('')
  }

  function setTime(i: number, next: Partial<PostingTime>) {
    patch({ postingTimes: s.postingTimes.map((t, idx) => (idx === i ? { ...t, ...next } : t)) })
  }

  function toggleDay(i: number, day: number) {
    const t = s.postingTimes[i]
    // Absent days = every day; the first toggle materializes the full set so
    // deselecting one day means "every day except this one".
    const days = t.days ?? [0, 1, 2, 3, 4, 5, 6]
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
    setTime(i, { days: next.length === 0 || next.length === 7 ? undefined : next })
  }

  async function toggleEnabled(v: boolean) {
    setError('')
    setEnableHint('')
    if (!v) {
      // OFF is always allowed: nothing to validate. Optimistic - flip the UI
      // now, persist in the background, roll back if the server disagrees.
      setPendingOn(false)
      if (!s.enabled) return
      const before = s
      setS({ ...s, enabled: false })
      setToggling(true)
      try {
        const res = await fetch('/api/autopilot', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setS(before)
          return setError(data.error ?? 'Could not turn autopilot off. Try again.')
        }
        setS(data.settings)
      } catch {
        setS(before)
        setError('Network error. Try again.')
      } finally {
        setToggling(false)
      }
      return
    }
    // ON: instant when the essentials exist; otherwise expand + hold the intent.
    if (!s.interests.length || !s.postingTimes.length || !s.platforms.length) {
      setPendingOn(true)
      setEnableHint('add a topic and a posting time below, then hit Save - autopilot starts right away.')
      return
    }
    const before = s
    setS({ ...s, enabled: true })
    setToggling(true)
    try {
      const res = await fetch('/api/autopilot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setS(before)
        setPendingOn(true)
        setEnableHint(data.error ?? 'Finish the setup below, then hit Save.')
        return
      }
      setS(data.settings)
      setPendingOn(false)
    } catch {
      setS(before)
      setError('Network error. Try again.')
    } finally {
      setToggling(false)
    }
  }

  async function save(overrides: Partial<AutopilotSettings> = {}) {
    setError('')
    setBusy('save')
    try {
      const next = { ...s, ...overrides }
      const res = await fetch('/api/autopilot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: next.enabled || pendingOn, // the tumbler's held intent (see pendingOn)
          interests: next.interests,
          postingTimes: next.postingTimes,
          timezone: next.timezone,
          platforms: next.platforms,
          reviewBeforePublish: next.reviewBeforePublish,
          aiImages: next.aiImages,
          // slotsPerDay is DERIVED server-side from the number of posting times -
          // each time slot IS one post per day.
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save. Try again.')
        return
      }
      setS(data.settings)
      setPendingOn(false)
      setEnableHint('')
      setSaved(true)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function pauseResume(action: 'pause' | 'resume') {
    setError('')
    setBusy(action)
    try {
      const res = await fetch(`/api/autopilot/${action}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      setS(data.settings)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const card = 'rounded-2xl border border-border-muted bg-surface-container-low p-5'

  // Scannable section headers: one icon + title line per card, same weight everywhere.
  const CardTitle = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <p className="mb-1 flex items-center gap-2 font-body-md text-body-md font-bold text-on-surface">
      <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-electric-indigo">{icon}</span>
      {children}
    </p>
  )

  return (
    <div className="flex flex-col gap-4">
      {pausedForCredits && (
        <div className="flex flex-col gap-2 rounded-2xl border border-error/40 bg-error/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body-sm text-body-sm text-on-surface">
            autopilot is paused - you&apos;re out of credits. top up to get it writing again.
          </p>
          <a href="/app/settings/billing" className="shrink-0 rounded-full bg-electric-indigo px-4 py-2 text-center font-code-label text-code-label font-bold text-white transition-colors hover:bg-primary-container">
            Top up credits
          </a>
        </div>
      )}

      {/* Master toggle - persists itself; the details below only show when on. */}
      <div className={`${card} flex items-center justify-between gap-4 ${toggling ? 'opacity-70' : ''}`}>
        <div>
          <p className="font-body-md text-body-md font-bold text-on-surface">Autopilot</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {s.enabled ? (s.pausedAt ? 'on, but paused' : 'on - filling empty slots ahead of time') : pendingOn ? 'almost on - finish the setup below' : 'off'}
          </p>
          {enableHint && <p className="mt-1 font-body-sm text-body-sm text-cyber-lime">{enableHint}</p>}
        </div>
        <Toggle on={s.enabled || pendingOn} onChange={(v) => { if (!toggling) void toggleEnabled(v) }} label="Autopilot enabled" />
      </div>

      {expanded && (<>

      {/* Interests */}
      <div className={card}>
        <CardTitle icon="tag">Interest areas</CardTitle>
        <p className="mb-3 font-body-sm text-body-sm text-on-surface-variant">What autopilot writes about, rotating day by day.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {s.interests.map((it) => (
            <span key={it} className="flex items-center gap-1 rounded-full border border-border-muted bg-surface-container px-3 py-1 font-code-label text-code-label text-on-surface">
              {it}
              <button type="button" aria-label={`Remove ${it}`} onClick={() => patch({ interests: s.interests.filter((x) => x !== it) })} className="text-on-surface-variant hover:text-error">
                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={interestDraft}
            onChange={(e) => setInterestDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }}
            placeholder="e.g. building in public"
            aria-label="Add interest"
            className="flex-1 rounded-xl border border-border-muted bg-surface-container-lowest p-2.5 font-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none"
          />
          <button type="button" onClick={addInterest} className="rounded-full border border-electric-indigo/60 px-4 font-code-label text-code-label text-electric-indigo transition-colors hover:bg-electric-indigo/10">
            Add
          </button>
        </div>
        {/* Tap-to-add suggestions while typing (e.g. "build" → "building in public"). */}
        {matchTopics(interestDraft, s.interests).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {matchTopics(interestDraft, s.interests).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { patch({ interests: [...s.interests, t] }); setInterestDraft('') }}
                className="rounded-full border border-cyber-lime/40 bg-cyber-lime/5 px-3 py-1 font-code-label text-code-label text-cyber-lime transition-colors hover:bg-cyber-lime/15"
              >
                + {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Posting times */}
      <div className={card}>
        <CardTitle icon="schedule">Posting times</CardTitle>
        <p className="mb-3 font-body-sm text-body-sm text-on-surface-variant">
          Slots autopilot can fill, in your timezone. Leave days unselected to post every day.
        </p>
        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="ap-timezone" className="font-code-label text-code-label uppercase text-on-surface-variant">Timezone</label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="ap-timezone"
              value={s.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              className="min-w-0 max-w-full flex-1 rounded-xl border border-border-muted bg-surface-container-lowest px-3.5 py-2.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none sm:max-w-xs"
            >
              {tzOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {deviceTz && deviceTz !== s.timezone && (
              <button
                type="button"
                onClick={() => patch({ timezone: deviceTz })}
                className="rounded-full border border-electric-indigo/50 px-3.5 py-2 font-code-label text-code-label text-electric-indigo transition-colors hover:bg-electric-indigo/10"
              >
                Use my timezone
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {s.postingTimes.map((t, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={t.time}
                onChange={(e) => setTime(i, { time: e.target.value })}
                aria-label={`Posting time ${i + 1}`}
                className="rounded-xl border border-border-muted bg-surface-container-lowest p-2 font-code-label text-code-label text-on-surface [color-scheme:dark] focus:border-electric-indigo focus:outline-none"
              />
              <div className="flex gap-1">
                {DAY_LABELS.map((label, day) => {
                  const on = !t.days || t.days.includes(day)
                  const explicit = t.days?.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={Boolean(explicit)}
                      onClick={() => toggleDay(i, day)}
                      className={`rounded-full border px-2 py-1 font-code-label text-[10px] uppercase transition-colors ${
                        on ? 'border-electric-indigo/60 text-electric-indigo' : 'border-border-muted text-on-surface-variant/50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <button type="button" aria-label="Remove time" onClick={() => patch({ postingTimes: s.postingTimes.filter((_, idx) => idx !== i) })} className="ml-auto text-on-surface-variant hover:text-error">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={!nextSlotFits}
            title={nextSlotFits ? undefined : 'Another slot would need more credits than your plan refills each month.'}
            onClick={() => patch({ postingTimes: [...s.postingTimes, { time: '09:00' }] })}
            className="self-start rounded-full border border-border-muted px-4 py-1.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:border-electric-indigo/60 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add time
          </button>
        </div>

        {/* Live burn meter: what THIS schedule costs a month vs the plan refill. */}
        {s.postingTimes.length > 0 && (
          <div className={`mt-4 rounded-xl border p-3.5 ${overBudget ? 'border-error/50 bg-error/5' : 'border-border-muted bg-surface-container-lowest'}`}>
            <div className="flex items-baseline justify-between gap-3 font-body-sm text-body-sm">
              <span className="text-on-surface-variant">
                ≈ {estimate.postsPerMonth} auto posts / mo · {fmtCredits(estimate.perPost)} credits each{s.aiImages ? ' (incl. AI image)' : ''}
              </span>
              <span className={`shrink-0 font-bold tabular-nums ${overBudget ? 'text-error' : 'text-on-surface'}`}>
                {fmtCredits(estimate.creditsPerMonth)}{monthlyAllowance != null && <> / {fmtCredits(monthlyAllowance)}</>} credits / mo
              </span>
            </div>
            {monthlyAllowance != null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className={`h-full rounded-full ${overBudget ? 'bg-error' : 'bg-cyber-lime'}`}
                  style={{ width: `${Math.min(100, Math.round((estimate.creditsPerMonth / monthlyAllowance) * 100))}%` }}
                />
              </div>
            )}
            {overBudget && (
              <p className="mt-2 font-body-sm text-body-sm text-error">
                This schedule needs more credits than your plan refills each month - remove a time slot{s.aiImages ? ' or switch off AI images' : ''}.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Platforms + review toggle */}
      <div className={card}>
        <CardTitle icon="send">Publish to</CardTitle>
        <div className="mt-3 flex gap-2">
          {SCHEDULE_PLATFORMS.map((p) => {
            const on = s.platforms.includes(p)
            const isConnected = connected[p]
            return (
              <button
                key={p}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!isConnected}
                title={isConnected ? undefined : `Connect ${platformLabel(p)} in Profile to enable`}
                onClick={() => patch({ platforms: on ? s.platforms.filter((x) => x !== p) : [...s.platforms, p] })}
                className={`flex items-center gap-2 rounded-full border border-border-muted bg-surface-container px-3.5 py-2 font-code-label text-code-label transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  on ? 'font-bold text-electric-indigo' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <PlatformGlyph platform={p} className={`h-4 w-4 ${on ? '' : 'opacity-60'}`} />
                {platformLabel(p)}
                {on && <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-electric-indigo">check</span>}
              </button>
            )
          })}
        </div>
        {s.platforms.includes('x') && !xPremium && (
          <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
            X is selected and your X isn&apos;t Premium, so auto posts stay under {X_FREE_POST_LIMIT} characters (X&apos;s rule).
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-body-md text-body-md text-on-surface">AI image on each post</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Generate a matching image for every auto post (2k credits per image).</p>
          </div>
          <Toggle on={s.aiImages} onChange={(v) => patch({ aiImages: v })} label="AI image on each post" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-body-md text-body-md text-on-surface">Review before publishing</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Get a heads-up when a post is queued, so you can edit or cancel it first.</p>
          </div>
          <Toggle on={s.reviewBeforePublish} onChange={(v) => patch({ reviewBeforePublish: v })} label="Review before publishing" />
        </div>
      </div>

      {/* Save + pause/resume */}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => save()}
          disabled={busy !== null || overBudget}
          title={overBudget ? 'The schedule exceeds your monthly plan credits - trim it first.' : undefined}
          className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-6 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
        >
          {busy === 'save' ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span>}
          Save
        </button>
        {s.enabled && (s.pausedAt ? (
          <button type="button" onClick={() => pauseResume('resume')} disabled={busy !== null} className="flex items-center gap-1.5 rounded-full border border-cyber-lime/60 px-5 py-2.5 font-code-label text-code-label text-cyber-lime transition-colors hover:bg-cyber-lime/10 disabled:opacity-60">
            {busy === 'resume' ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">play_arrow</span>}
            Resume
          </button>
        ) : (
          <button type="button" onClick={() => pauseResume('pause')} disabled={busy !== null} className="flex items-center gap-1.5 rounded-full border border-border-muted px-5 py-2.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-60">
            {busy === 'pause' ? <Spinner size={16} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px]">pause</span>}
            Pause
          </button>
        ))}
        {saved && <span aria-live="polite" className="font-code-label text-code-label text-cyber-lime">saved</span>}
      </div>

      {/* Upcoming auto posts */}
      <div className={card}>
        <CardTitle icon="auto_awesome">Queued by autopilot</CardTitle>
        <div className="mb-2" />
        {upcoming.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant/60">
            nothing queued yet - posts appear here up to {Math.round(s.leadTimeMinutes / 60)}h before their slot.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((p) => (
              <a key={p.id} href="/app/calendar" className="flex items-start gap-2 rounded-xl border border-cyber-lime/30 p-3 transition-colors hover:border-cyber-lime/60">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyber-lime" />
                <span className="min-w-0">
                  <span className="font-code-label text-code-label text-on-surface">
                    {new Date(p.scheduledFor).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block font-body-sm text-body-sm text-on-surface-variant">{p.content}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
      </>)}
    </div>
  )
}
