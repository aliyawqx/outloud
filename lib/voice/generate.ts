import { type VoiceProfile as VoiceInput } from '@/lib/anthropic'
import { getSource } from './catalog'
import type { DraftPost, GeneratePostInput, VoiceProfile } from './types'

/** Thrown by the `generatePost` seam until composing is turned on. */
export class NotImplementedError extends Error {
  constructor(message = 'generatePost is not wired yet') {
    super(message)
    this.name = 'NotImplementedError'
  }
}

/** Raised when an own-voice profile has no captured data to write from yet. */
export class VoiceNotReadyError extends Error {
  constructor(message = 'This voice has no captured style yet.') {
    super(message)
    this.name = 'VoiceNotReadyError'
  }
}

/**
 * Map a persisted, blended {@link VoiceProfile} → the generator's voice input
 * ({@link VoiceInput} in lib/anthropic). Kept ready so generation drops in
 * cleanly later: an inspiration blend becomes a weighted style `summary` plus
 * short paraphrased snippets as cadence anchors.
 */
export function toVoiceInput(profile: VoiceProfile): VoiceInput {
  if (profile.kind === 'own') {
    throw new VoiceNotReadyError('Train your own voice before composing with it.')
  }

  const resolved = profile.sources.map((s) => ({ source: getSource(s.sourceId), weight: s.weight }))
  const known = resolved.filter((r): r is { source: NonNullable<typeof r.source>; weight: number } =>
    Boolean(r.source),
  )
  if (known.length === 0) throw new VoiceNotReadyError('This blend has no known creators.')

  const total = known.reduce((sum, r) => sum + (r.weight || 1), 0)
  const lines = known
    .map((r) => {
      const pct = Math.round(((r.weight || 1) / total) * 100)
      return `(${pct}%) ${r.source.displayName}: ${r.source.styleDescriptor}`
    })
    .join('\n\n')

  const summary =
    `Write in a HYBRID style that blends these voices by the given weights. Merge their ` +
    `tendencies into one coherent voice — do NOT impersonate any single person, do not ` +
    `attribute or invent quotes, and never claim to BE them.\n\n${lines}`

  const samples = known.flatMap((r) => r.source.exampleSnippets).filter(Boolean)

  return { summary, samples }
}

/**
 * THE SEAM. The AI Post Composer will call this with an idea + a saved/blended
 * VoiceProfile and get back a {@link DraftPost}. Not turned on yet — the mapping
 * in {@link toVoiceInput} is ready; the generation body lands when composing ships.
 */
export async function generatePost(input: GeneratePostInput): Promise<DraftPost> {
  void input
  throw new NotImplementedError()
}
