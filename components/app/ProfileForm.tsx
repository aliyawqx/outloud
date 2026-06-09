'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Spinner } from '@/components/Spinner'

type Initial = { displayName: string; handle: string; avatarUrl: string; plan: string }

const field =
  'w-full rounded-lg border border-border-muted bg-surface-container-lowest px-4 py-3 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none'

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [handle, setHandle] = useState(initial.handle)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, handle, avatarUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save. Try again.')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={onSave} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">Display name</span>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={field} maxLength={80} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">X handle (optional)</span>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} className={field} placeholder="yourhandle" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-code-label text-code-label uppercase text-on-surface-variant">Avatar URL (optional)</span>
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className={field} placeholder="https://…" />
      </label>

      <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
        <span className="font-code-label text-code-label text-on-surface-variant">
          Plan · <span className="capitalize text-on-surface">{initial.plan}</span>
        </span>
        <span className="font-code-label text-code-label text-on-surface-variant/60">billing later</span>
      </div>

      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      {saved && <p className="font-body-sm text-body-sm text-cyber-lime">Saved.</p>}

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-full bg-electric-indigo px-6 py-2.5 font-bold text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
        >
          {saving ? <><Spinner size={16} /> Saving…</> : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-error"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span> Sign out
        </button>
      </div>
    </form>
  )
}
