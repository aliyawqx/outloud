'use client'

import { useEffect, useState } from 'react'
import {
  fetchProfiles,
  patchProfile,
  removeProfile,
  saveProfile,
} from '@/lib/voice/client'
import { getSource } from '@/lib/voice/catalog'
import type { VoiceProfile } from '@/lib/voice/types'
import { VoiceLibrary } from './VoiceLibrary'
import { BlendPreview } from './BlendPreview'
import { MyVoices } from './MyVoices'
import { EmptyState } from './EmptyState'

type Tab = 'library' | 'mine'

export function VoiceStudio() {
  const [tab, setTab] = useState<Tab>('library')
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function refresh() {
    setLoadError('')
    try {
      const { profiles } = await fetchProfiles()
      setProfiles(profiles)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your voices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const toggle = (id: string) =>
    setSelectedIds((cur) => {
      if (cur.includes(id)) {
        setWeights(({ [id]: _drop, ...rest }) => rest)
        return cur.filter((x) => x !== id)
      }
      setWeights((w) => ({ ...w, [id]: w[id] ?? 3 }))
      return [...cur, id]
    })

  const setWeight = (id: string, w: number) => setWeights((cur) => ({ ...cur, [id]: w }))

  async function onSave() {
    setSaveError('')
    if (selectedIds.length === 0) {
      setSaveError('Pick at least one creator.')
      return
    }
    const fallback = selectedIds.map((id) => getSource(id)?.displayName.split(' ')[0]).filter(Boolean).join(' × ')
    setSaving(true)
    try {
      await saveProfile({
        name: name.trim() || fallback,
        kind: 'inspiration',
        sources: selectedIds.map((id) => ({ sourceId: id, weight: weights[id] ?? 3 })),
        isActive: true,
      })
      setSelectedIds([])
      setWeights({})
      setName('')
      await refresh()
      setTab('mine')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save your voice.')
    } finally {
      setSaving(false)
    }
  }

  async function withBusy(id: string, fn: () => Promise<unknown>) {
    setBusyId(id)
    try {
      await fn()
      await refresh()
    } catch {
      /* surfaced on next load; keep the UI responsive */
    } finally {
      setBusyId(null)
    }
  }

  const onSetActive = (id: string) => withBusy(id, () => patchProfile(id, { isActive: true }))
  const onRename = (id: string, newName: string) => withBusy(id, () => patchProfile(id, { name: newName }))
  const onDelete = (id: string) => withBusy(id, () => removeProfile(id))

  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      aria-current={tab === t}
      className={`rounded-full px-5 py-2 font-code-label text-code-label transition-colors ${
        tab === t ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && <span className="ml-1.5 opacity-70">({count})</span>}
    </button>
  )

  return (
    <>
      {/* tabs */}
      <div className="reveal mb-8 inline-flex items-center gap-1 rounded-full border border-border-muted bg-surface-container-low p-1">
        {tabBtn('library', 'Voice library')}
        {tabBtn('mine', 'My voices', profiles.length)}
      </div>

      {tab === 'library' && (
        <div className="reveal grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_360px]" style={{ transitionDelay: '80ms' }}>
          <VoiceLibrary selectedIds={selectedIds} onToggle={toggle} />
          <BlendPreview
            selectedIds={selectedIds}
            weights={weights}
            onWeight={setWeight}
            name={name}
            onName={setName}
            onClear={() => {
              setSelectedIds([])
              setWeights({})
            }}
            onSave={onSave}
            saving={saving}
            error={saveError}
          />
        </div>
      )}

      {tab === 'mine' && (
        <div className="reveal" style={{ transitionDelay: '80ms' }}>
          {loading ? (
            <div className="py-16 text-center font-code-label text-code-label text-on-surface-variant/60">loading…</div>
          ) : loadError ? (
            <div className="rounded-2xl border border-error/30 bg-error/5 p-6 text-center font-body-sm text-body-sm text-error">
              {loadError}{' '}
              <button onClick={refresh} className="underline">
                retry
              </button>
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState onBrowse={() => setTab('library')} />
          ) : (
            <MyVoices
              profiles={profiles}
              onSetActive={onSetActive}
              onDelete={onDelete}
              onRename={onRename}
              busyId={busyId}
            />
          )}
        </div>
      )}
    </>
  )
}
