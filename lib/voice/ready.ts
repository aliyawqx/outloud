import type { VoiceProfile } from './types'

// A voice is "ready" (usable for generation, lets the user past the onboarding
// gate) when it can actually drive a post:
//  - an inspiration blend that has at least one source creator, or
//  - an own/captured voice whose Style Guide has been extracted.
// A voice with raw samples but no extracted guide is NOT ready yet — the user
// must finish onboarding (run extraction) first. There is no default voice.
export function isVoiceReady(p: VoiceProfile): boolean {
  if (p.kind === 'inspiration') return (p.sources?.length ?? 0) > 0
  return p.styleGuide.trim() !== ''
}

export function hasReadyVoice(profiles: VoiceProfile[]): boolean {
  return profiles.some(isVoiceReady)
}
