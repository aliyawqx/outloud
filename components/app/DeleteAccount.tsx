'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Danger zone: permanently delete the account. Two-step + typed confirmation,
// because it's irreversible and wipes voices, history, prompts and X connection.
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
    <div className="mt-12 rounded-2xl border border-error/30 p-5">
      <h2 className="font-headline-sm text-headline-sm text-error">Delete account</h2>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Permanently delete your account and everything in it - voices, history, prompts and your X
        connection. This can’t be undone.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full border border-error/40 px-5 py-2.5 font-bold text-error transition-all hover:bg-error/10 active:scale-95"
        >
          Delete account
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
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
              className="rounded-full bg-error px-5 py-2.5 font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Permanently delete'}
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
