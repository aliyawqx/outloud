'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Spinner } from '@/components/Spinner'

// Permanently delete the account. Deliberately quiet (no card, no blurb) - just
// the action; the typed confirmation stays because the delete is irreversible.
export function DeleteAccount() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canDelete = confirm.trim().toLowerCase() === 'delete' && !busy

  async function remove() {
    if (!canDelete) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not delete your account. Try again.')
        setBusy(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Network error. Try again.')
      setBusy(false)
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-error"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span> Delete account
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-code-label text-code-label uppercase text-on-surface-variant">
              Type <span className="text-error">delete</span> to confirm
            </span>
            <input
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setError('')
              }}
              autoFocus
              placeholder="delete"
              className="w-full rounded-lg border border-border-muted bg-surface-container-lowest px-4 py-3 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-error focus:outline-none"
            />
          </label>
          {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={!canDelete}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-error px-5 py-2.5 font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              {busy ? <><Spinner size={16} /> Deleting…</> : 'Permanently delete'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setConfirm('')
                setError('')
              }}
              disabled={busy}
              className="font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
