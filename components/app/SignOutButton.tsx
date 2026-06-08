'use client'

import { useRouter } from 'next/navigation'

export function SignOutButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }
  return (
    <button
      type="button"
      onClick={signOut}
      className={`flex items-center gap-2 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-error ${className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">logout</span> Sign out
    </button>
  )
}
