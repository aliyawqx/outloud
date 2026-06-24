'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createOwnVoice,
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

export function VoiceStudio({ onboarding = false }: { onboarding?: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('library')
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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
      // During onboarding this voice is now ready → straight into the app. Otherwise
      // (managing voices) stay here and show the saved voice in "My voices".
      if (onboarding) {
        router.push('/app')
        router.refresh()
        return
      }
      await refresh()
      setTab('mine')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save your voice.')
    } finally {
      setSaving(false)
    }
  }

  // Optimistic updates: reflect the change in the UI immediately, then sync in
  // the background and only refetch if the server rejects it. Set-active is a
  // slow multi-statement transaction over the network, so blocking the UI on it
  // (await call → await refetch) read as "nothing happened / it's broken".
  const onSetActive = (id: string) => {
    setProfiles((ps) => ps.map((p) => ({ ...p, isActive: p.id === id })))
    patchProfile(id, { isActive: true }).catch(refresh)
  }
  const onRename = (id: string, newName: string) => {
    setProfiles((ps) => ps.map((p) => (p.id === id ? { ...p, name: newName } : p)))
    patchProfile(id, { name: newName }).catch(refresh)
  }
  const onDelete = (id: string) => {
    setProfiles((ps) => ps.filter((p) => p.id !== id))
    removeProfile(id).catch(refresh)
  }

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

  async function createOwn() {
    const name = window.prompt('Name your voice', 'My voice')?.trim()
    if (!name) return
    try {
      const { profile } = await createOwnVoice(name)
      router.push(`/app/voices/${profile.id}`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not create that voice.')
    }
  }

  return (
    <>
      {/* During onboarding, a clear way back to the setup screen. */}
      {onboarding && (
        <Link
          href="/app/onboarding"
          className="reveal mb-5 inline-flex items-center gap-1.5 font-code-label text-code-label text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to setup
        </Link>
      )}

      {/* tabs */}
      <div className="reveal mb-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-surface-container-low p-1">
          {tabBtn('library', 'Voice library')}
          {tabBtn('mine', 'My voices', profiles.length)}
        </div>
        <button
          type="button"
          data-tour="capture-own"
          onClick={createOwn}
          className="inline-flex items-center gap-1.5 rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-4 py-2 font-code-label text-code-label text-cyber-lime transition-all hover:bg-cyber-lime/20"
        >
          <span className="material-symbols-outlined text-[16px]">add</span> Capture your own voice
        </button>
      </div>

      {tab === 'library' && (
        <div className="reveal grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_360px]" style={{ transitionDelay: '80ms' }}>
          <div data-tour="voice-library">
            <VoiceLibrary selectedIds={selectedIds} onToggle={toggle} />
          </div>
          <div data-tour="blend-save">
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
            />
          )}
        </div>
      )}
    </>
  )
}
