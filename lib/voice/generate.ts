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
  const pct = (w: number) => Math.round(((w || 1) / total) * 100)
  const snippets = known.flatMap((r) => r.source.exampleSnippets).filter(Boolean)
  const blendInstruction =
    `Write in a HYBRID style that blends these voices by the given weights. Merge their ` +
    `tendencies into one coherent voice - do NOT impersonate any single person, do not ` +
    `attribute or invent quotes, and never claim to BE them.`

  // Creators that ship a FULL Style Guide drive generation precisely. A single
  // creator → their guide verbatim; a blend → guides stacked by weight.
  if (known.some((r) => r.source.styleGuide?.trim())) {
    if (known.length === 1) {
      return { styleGuide: known[0].source.styleGuide!.trim(), samples: snippets }
    }
    const guideBlocks = known
      .map((r) => `(${pct(r.weight)}%) ${r.source.displayName}:\n${r.source.styleGuide?.trim() || r.source.styleDescriptor}`)
      .join('\n\n---\n\n')
    return { styleGuide: guideBlocks, summary: blendInstruction, samples: snippets }
  }

  // Fallback: short descriptors only (creators without a full guide).
  const lines = known.map((r) => `(${pct(r.weight)}%) ${r.source.displayName}: ${r.source.styleDescriptor}`).join('\n\n')
  return { summary: `${blendInstruction}\n\n${lines}`, samples: snippets }
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
    reviseBase: input.reviseBase,
    formatText: input.formatText,
    progressDay: input.progressDay,
    progressTotal: input.progressTotal,
    followerCount: input.followerCount,
  })
}
