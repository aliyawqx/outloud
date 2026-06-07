// Browser client for the format-prompt (slash command) library.
import type { Prompt } from './store'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong.')
  return data as T
}

export type { Prompt }
export type DefaultPrompt = { command: string; title: string; text: string }

export function fetchPrompts(): Promise<{ defaults: DefaultPrompt[]; custom: Prompt[] }> {
  return api('/api/prompts')
}

export function createPrompt(input: { command: string; title: string; text: string }): Promise<{ prompt: Prompt }> {
  return api('/api/prompts', { method: 'POST', body: JSON.stringify(input) })
}

export function updatePrompt(
  id: string,
  patch: { command?: string; title?: string; text?: string },
): Promise<{ prompt: Prompt }> {
  return api(`/api/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deletePrompt(id: string): Promise<{ ok: true }> {
  return api(`/api/prompts/${id}`, { method: 'DELETE' })
}
