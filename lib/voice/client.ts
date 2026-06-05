// Browser-side client for the voice API. Identity comes from the auth session
// cookie (sent automatically on same-origin requests) — no manual owner key.
import type { DraftPost, HookIntensity, ProfileKind, SampleSource, SourceRef, VoiceProfile, WritingSample } from './types'

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

/** Create an empty own-voice profile (to attach samples + a Style Guide to). */
export function createOwnVoice(name: string): Promise<{ profile: VoiceProfile }> {
  return api('/api/voice/profiles', {
    method: 'POST',
    body: JSON.stringify({ name, kind: 'own', sources: [], isActive: true }),
  })
}

// ── Writing samples ────────────────────────────────────────────────────────────

export function fetchSamples(profileId: string): Promise<{ samples: WritingSample[] }> {
  return api(`/api/voice/profiles/${profileId}/samples`)
}

export function addSample(
  profileId: string,
  body: { source: SampleSource; text?: string; url?: string },
): Promise<{ sample: WritingSample }> {
  return api(`/api/voice/profiles/${profileId}/samples`, { method: 'POST', body: JSON.stringify(body) })
}

export function toggleSample(
  profileId: string,
  sampleId: string,
  usedInStyle: boolean,
): Promise<{ sample: WritingSample }> {
  return api(`/api/voice/profiles/${profileId}/samples/${sampleId}`, {
    method: 'PATCH',
    body: JSON.stringify({ usedInStyle }),
  })
}

export function deleteSample(profileId: string, sampleId: string): Promise<{ ok: true }> {
  return api(`/api/voice/profiles/${profileId}/samples/${sampleId}`, { method: 'DELETE' })
}

// ── Style guide ──────────────────────────────────────────────────────────────

export function generateStyleGuide(profileId: string): Promise<{ profile: VoiceProfile }> {
  return api(`/api/voice/profiles/${profileId}/style-guide`, { method: 'POST' })
}

export function saveStyleGuide(
  profileId: string,
  body: { guideMarkdown: string; summary?: string },
): Promise<{ profile: VoiceProfile }> {
  return api(`/api/voice/profiles/${profileId}/style-guide`, { method: 'PATCH', body: JSON.stringify(body) })
}

// ── Compose ──────────────────────────────────────────────────────────────────

export function compose(body: {
  idea: string
  profileId?: string
  count?: number
  hookIntensity?: HookIntensity
  link?: string
}): Promise<{ drafts?: DraftPost[]; clarify?: string; voiceName: string; historyId?: string }> {
  return api('/api/voice/compose', { method: 'POST', body: JSON.stringify(body) })
}

export function deleteHistory(id: string): Promise<{ ok: true }> {
  return api(`/api/voice/history/${id}`, { method: 'DELETE' })
}
