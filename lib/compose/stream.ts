// Shared contract for the live "under the hood" status feed during compose.
// The /api/voice/chat route streams these as SSE; ComposeHome consumes them.
// Every status maps to a REAL pipeline stage — emitted as that stage runs, never
// faked. Stages that don't run for a given request simply never emit.
import type { DraftPost } from '@/lib/voice/types'

export type StatusStep = 'parse' | 'voice' | 'context' | 'draft' | 'polish'

/** Default copy per stage (lowercase, Outloud voice). `{topic}` in context is
 *  replaced with the model's actual search query. */
export const STATUS_COPY: Record<StatusStep, { label: string; tag?: string }> = {
  parse: { label: 'reading what you actually want to say' },
  voice: { label: 'pulling your voice profile', tag: 'voice' },
  context: { label: 'scanning recent {topic} for angles', tag: 'context' },
  draft: { label: 'drafting in your voice', tag: 'draft' },
  polish: { label: 'stripping em-dashes and ai tells', tag: 'polish' },
}

export type StatusEvent = { type: 'status'; step: StatusStep; label: string; tag?: string }

/** Terminal success event — mirrors the old JSON response shape so the client
 *  applies it exactly as before (ask branch, draft branch, history, credits). */
export type DoneEvent = {
  type: 'done'
  ask?: string
  options?: string[]
  draft?: DraftPost
  voiceName?: string
  historyId?: string
  creditsLeft?: number
}

/** Terminal failure event mid-stream (the response status is already 200 by then,
 *  so failures travel as events the client maps to the same UX as HTTP errors). */
export type ErrorEvent = {
  type: 'error'
  error: string
  insufficientCredits?: boolean
  cost?: number
  balance?: number
  needsVoice?: boolean
  retryable?: boolean
}

export type ComposeEvent = StatusEvent | DoneEvent | ErrorEvent

/** Build a status event, interpolating the research topic into the context line. */
export function statusEvent(step: StatusStep, topic?: string): StatusEvent {
  const { label, tag } = STATUS_COPY[step]
  const short = (topic ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  return { type: 'status', step, label: short ? label.replace('{topic}', short) : label.replace('{topic} ', ''), tag }
}
