import type { HookIntensity } from './anthropic'

const INTENSITIES: HookIntensity[] = ['safe', 'bold', 'spicy', 'funny']
const SAMPLE_MAX = 1000
const REPLY_MAX = 25000
const ANGLE_MAX = 500

export type ReplyInput = {
  samples?: unknown
  replyTo?: unknown
  angle?: unknown
  hookIntensity?: unknown
  subtleHumor?: unknown
}

export type ReplyValue = {
  samples: string[]
  replyTo: string
  angle?: string
  hookIntensity: HookIntensity
  subtleHumor: boolean
}

export type ReplyValidation = { ok: true; value: ReplyValue } | { ok: false; error: string }

export function validateReplyInput(input: ReplyInput): ReplyValidation {
  // Voice samples are optional — when omitted, the model writes in its default voice.
  const samples = Array.isArray(input.samples)
    ? input.samples
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  if (samples.some((s) => s.length > SAMPLE_MAX)) {
    return { ok: false, error: 'One of your sample posts is too long.' }
  }

  const replyTo = typeof input.replyTo === 'string' ? input.replyTo.trim() : ''
  if (!replyTo) return { ok: false, error: 'Paste the post you want to reply to.' }
  if (replyTo.length > REPLY_MAX) return { ok: false, error: 'That post is too long.' }

  let angle: string | undefined
  if (typeof input.angle === 'string') {
    const a = input.angle.trim()
    if (a.length > ANGLE_MAX) return { ok: false, error: 'Keep your angle short.' }
    angle = a.length ? a : undefined
  }

  let hookIntensity: HookIntensity = 'bold'
  if (input.hookIntensity !== undefined) {
    if (!INTENSITIES.includes(input.hookIntensity as HookIntensity)) {
      return { ok: false, error: 'Invalid hook intensity.' }
    }
    hookIntensity = input.hookIntensity as HookIntensity
  }

  const subtleHumor = input.subtleHumor === undefined ? true : Boolean(input.subtleHumor)

  return { ok: true, value: { samples, replyTo, angle, hookIntensity, subtleHumor } }
}
