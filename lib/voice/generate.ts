import { generateDrafts, type VoiceProfile as VoiceInput } from '@/lib/anthropic'
import { getSource } from './catalog'
import type { DraftPost, GeneratePostInput, VoiceProfile } from './types'

/** Raised when a profile has nothing to write from (no guide, no samples, no sources). */
export class VoiceNotReadyError extends Error {
  constructor(message = 'This voice has no captured style yet.') {
    super(message)
    this.name = 'VoiceNotReadyError'
  }
}

/**
 * Map a persisted {@link VoiceProfile} (+ raw sample texts) → the generation
 * core's voice input. Own voices drive on their captured Style Guide + sample
 * anchors; inspiration blends drive on the weighted source descriptors.
 */
export function toVoiceInput(profile: VoiceProfile, sampleTexts: string[] = []): VoiceInput {
  if (profile.kind === 'own') {
    const guide = profile.styleGuide?.trim()
    if (!guide && sampleTexts.length === 0) {
      throw new VoiceNotReadyError('Add writing samples and generate a Style Guide first.')
    }
    return { styleGuide: guide || undefined, samples: sampleTexts }
  }

  // inspiration blend
  const resolved = profile.sources.map((s) => ({ source: getSource(s.sourceId), weight: s.weight }))
  const known = resolved.filter((r): r is { source: NonNullable<typeof r.source>; weight: number } =>
    Boolean(r.source),
  )
  if (known.length === 0) throw new VoiceNotReadyError('This blend has no known creators.')

  const total = known.reduce((sum, r) => sum + (r.weight || 1), 0)
  const lines = known
    .map((r) => `(${Math.round(((r.weight || 1) / total) * 100)}%) ${r.source.displayName}: ${r.source.styleDescriptor}`)
    .join('\n\n')
  const summary =
    `Write in a HYBRID style that blends these voices by the given weights. Merge their ` +
    `tendencies into one coherent voice — do NOT impersonate any single person, do not ` +
    `attribute or invent quotes, and never claim to BE them.\n\n${lines}`
  const snippets = known.flatMap((r) => r.source.exampleSnippets).filter(Boolean)
  return { summary, samples: snippets }
}

/**
 * THE SEAM. Generate N distinct post drafts for an idea in a saved voice, using
 * the HSO post prompt + the voice's Style Guide + raw sample anchors, with
 * day/follower context injected by code. Returns a clarifying ask instead of
 * drafts when the idea is unclear.
 */
export async function generatePost(
  input: GeneratePostInput,
): Promise<{ drafts: DraftPost[]; clarify: string }> {
  const voice = toVoiceInput(input.voiceProfile, input.samples ?? [])
  const count = Math.min(4, Math.max(1, input.count ?? 1))

  return generateDrafts(voice, {
    kind: 'ship',
    input: input.idea,
    count,
    hookIntensity: input.hookIntensity ?? 'bold',
    optionalLink: input.link,
    progressDay: input.progressDay,
    progressTotal: input.progressTotal,
    followerCount: input.followerCount,
  })
}
