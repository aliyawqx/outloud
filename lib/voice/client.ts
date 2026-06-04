// Browser-side client for the voice API. Holds the anonymous owner key in
// localStorage and attaches it to every request. Safe to import from client
// components only (touches window/localStorage).
import type { ProfileKind, SourceRef, VoiceProfile } from './types'

const OWNER_STORAGE_KEY = 'outloud.ownerKey'

/** Read or lazily create the stable anonymous owner key. */
export function getOwnerKey(): string {
  let key = localStorage.getItem(OWNER_STORAGE_KEY)
  if (!key) {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ''
    key = (uuid || `o-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '')
    localStorage.setItem(OWNER_STORAGE_KEY, key)
  }
  return key
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-owner-key': getOwnerKey(), ...(init?.headers ?? {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong.')
  return data as T
}

export function fetchProfiles(): Promise<{ profiles: VoiceProfile[] }> {
  return api('/api/voice/profiles')
}

export function saveProfile(input: {
  name: string
  kind: ProfileKind
  sources: SourceRef[]
  isActive?: boolean
}): Promise<{ profile: VoiceProfile }> {
  return api('/api/voice/profiles', { method: 'POST', body: JSON.stringify(input) })
}

export function patchProfile(
  id: string,
  patch: { name?: string; sources?: SourceRef[]; isActive?: boolean },
): Promise<{ profile: VoiceProfile }> {
  return api(`/api/voice/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function removeProfile(id: string): Promise<{ ok: true }> {
  return api(`/api/voice/profiles/${id}`, { method: 'DELETE' })
}
