'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { deleteHistory, renameHistory } from '@/lib/voice/client'

export type SidebarHistoryItem = { id: string; title: string }

/**
 * Inline chat history in the sidebar. Reuses the compose_history data source - this
 * is display + rename/delete only; clicking an item reopens that chat in the composer.
 */
export function SidebarHistory({ initial, onNavigate }: { initial: SidebarHistoryItem[]; onNavigate?: () => void }) {
  const router = useRouter()
  const activeId = useSearchParams().get('session')
  const [items, setItems] = useState(initial)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  // Keep the list in sync if the server passes a fresh snapshot (e.g. after a new chat).
  useEffect(() => setItems(initial), [initial])

  // Close the kebab menu on any outside click.
  useEffect(() => {
    if (!menuId) return
    const close = () => setMenuId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuId])

  useEffect(() => {
    if (editingId) editRef.current?.select()
  }, [editingId])

  function open(id: string) {
    onNavigate?.()
    router.push(`/app?session=${id}`)
  }

  function startRename(item: SidebarHistoryItem) {
    setMenuId(null)
    setDraft(item.title)
    setEditingId(item.id)
  }

  function commitRename() {
    const id = editingId
    if (!id) return
    setEditingId(null)
    const title = draft.trim()
    const original = items.find((x) => x.id === id)?.title ?? ''
    if (!title || title === original) return
    setItems((list) => list.map((x) => (x.id === id ? { ...x, title } : x)))
    renameHistory(id, title).catch(() => {
      // Revert on failure.
      setItems((list) => list.map((x) => (x.id === id ? { ...x, title: original } : x)))
    })
  }

  async function remove(id: string) {
    setMenuId(null)
    const prev = items
    setItems((list) => list.filter((x) => x.id !== id))
    try {
      await deleteHistory(id)
    } catch {
      setItems(prev)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-4">
      <div className="flex items-center gap-2 px-3 pb-1">
        <span className="font-code-label text-[11px] uppercase tracking-widest text-on-surface-variant/60">History</span>
        {items.length > 0 && (
          <span className="rounded-full bg-surface-container-high px-1.5 font-code-label text-[10px] text-on-surface-variant">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-3 pt-1 font-body-sm text-body-sm text-on-surface-variant/60">
          No chats yet.{' '}
          <Link href="/app" onClick={onNavigate} className="text-on-surface-variant underline hover:text-on-surface">
            Start a new one
          </Link>
          .
        </p>
      ) : (
        <ul className="sidebar-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 py-1">
          {items.map((item) => {
            const active = item.id === activeId
            const editing = item.id === editingId
            const menuOpen = item.id === menuId
            return (
              <li key={item.id} className="group relative">
                {editing ? (
                  <input
                    ref={editRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      else if (e.key === 'Escape') setEditingId(null)
                    }}
                    aria-label="Rename chat"
                    className="w-full rounded-lg border border-electric-indigo bg-surface-container-low px-2 py-1.5 font-body-sm text-body-sm text-on-surface focus:outline-none"
                  />
                ) : (
                  <div
                    className={`flex items-center gap-1 rounded-lg pl-2 pr-1 transition-colors ${
                      active || menuOpen ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => open(item.id)}
                      title={item.title}
                      className={`min-w-0 flex-1 truncate py-1.5 text-left font-body-sm text-body-sm ${
                        active ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {item.title || 'Untitled chat'}
                    </button>
                    <button
                      type="button"
                      aria-label="Chat actions"
                      aria-haspopup="menu"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuId(menuOpen ? null : item.id)
                      }}
                      className={`shrink-0 rounded p-1 text-on-surface-variant transition-all hover:bg-white/[0.08] hover:text-on-surface focus:opacity-100 ${
                        menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <span aria-hidden="true" className="material-symbols-outlined block text-[18px] leading-none">more_vert</span>
                    </button>
                  </div>
                )}

                {menuOpen && (
                  <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-1 top-full z-20 mt-0.5 w-32 overflow-hidden rounded-lg border border-border-muted bg-surface-container-high py-1 shadow-lg shadow-charcoal-black/40"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => startRename(item)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-white/[0.06] hover:text-on-surface"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">edit</span> Rename
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => remove(item.id)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete</span> Delete
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
