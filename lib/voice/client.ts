// Browser-side client for the voice API. Identity comes from the auth session
// cookie (sent automatically on same-origin requests) — no manual owner key.
import type { ProfileKind, SourceRef, VoiceProfile } from './types'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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
