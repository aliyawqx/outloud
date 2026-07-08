import { getSource } from './catalog'
import { blendProfile, type BlendResult } from './blend'
import type { SourceRef } from './types'

/** Raised when a profile references a creator that isn't in the catalog. */
export class UnknownSourceError extends Error {
  constructor(public sourceId: string) {
    super(`Unknown voice source: ${sourceId}`)
    this.name = 'UnknownSourceError'
  }
}

/** Resolve source ids against the catalog and blend them into a style summary. */
export function buildInspiration(refs: SourceRef[]): BlendResult {
  const inputs = refs.map((ref) => {
    const source = getSource(ref.sourceId)
    if (!source) throw new UnknownSourceError(ref.sourceId)
    return { source, weight: ref.weight }
  })
  return blendProfile(inputs)
}

/** The placeholder shape for an 'own' voice (training lands in a later phase). */
export function buildOwn(): { mergedTags: string[]; styleSummary: string } {
  return {
    mergedTags: [],
    styleSummary:
      'Your own captured voice.\n\n' +
      '// TODO: train from your posts later - Phase 1 models the own-voice profile but does not capture it yet.',
  }
}
