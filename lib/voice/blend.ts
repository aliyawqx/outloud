import type { SourceRef, VoiceSource } from './types'

// Pure blending logic. No DB, no LLM, no catalog import — takes resolved sources
// so it's trivially unit-testable. The API layer resolves ids → sources first.

export type BlendInput = {
  source: VoiceSource
  /** Relative weight (> 0). Defaults to 1. */
  weight?: number
}

export type BlendResult = {
  sources: SourceRef[]
  mergedTags: string[]
  /** Templated hybrid summary. Phase 1 only — see the TODO line it emits. */
  styleSummary: string
}

/** Union the sources' tags, deduped, preserving first appearance. */
function mergeTags(inputs: BlendInput[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const { source } of inputs) {
    for (const tag of source.tags) {
      if (!seen.has(tag)) {
        seen.add(tag)
        out.push(tag)
      }
    }
  }
  return out
}

/** Normalize weights to integer percentages that sum to 100. */
function toPercentages(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return weights.map(() => 0)
  const raw = weights.map((w) => (w / total) * 100)
  const floored = raw.map(Math.floor)
  // Hand out the leftover points to the largest remainders so they sum to 100.
  let remainder = 100 - floored.reduce((a, b) => a + b, 0)
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  const result = [...floored]
  for (const { i } of order) {
    if (remainder <= 0) break
    result[i] += 1
    remainder -= 1
  }
  return result
}

/** First sentence of a descriptor, for the compact per-source line. */
function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}

/**
 * Blend one or more inspiration sources into a single hybrid style summary.
 * Throws on an empty input list — callers validate first.
 */
export function blendProfile(inputs: BlendInput[]): BlendResult {
  if (inputs.length === 0) {
    throw new Error('blendProfile requires at least one source')
  }

  const weights = inputs.map(({ weight = 1 }) => (weight > 0 ? weight : 1))
  const sources: SourceRef[] = inputs.map(({ source }, i) => ({
    sourceId: source.id,
    weight: weights[i],
  }))
  const mergedTags = mergeTags(inputs)

  // Single source: just present that creator's descriptor.
  if (inputs.length === 1) {
    const s = inputs[0].source
    const styleSummary =
      `Writes in the style of ${s.displayName} (@${s.handle}).\n\n` +
      `${s.styleDescriptor}\n\n` +
      `Style tags: ${mergedTags.join(', ')}.\n\n` +
      `// TODO: enrich via model later — Phase 1 uses the source's descriptor verbatim.`
    return { sources, mergedTags, styleSummary }
  }

  // Multiple sources: a weighted template merge of the descriptors.
  const pcts = toPercentages(weights)
  const names = inputs.map(({ source }) => source.displayName)
  const nameList =
    names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`

  const lines = inputs
    .map(({ source }, i) => `• ${source.displayName} (${pcts[i]}%): ${firstSentence(source.styleDescriptor)}`)
    .join('\n')

  const styleSummary =
    `A hybrid voice blending ${nameList}.\n\n` +
    `${lines}\n\n` +
    `Merged style tags: ${mergedTags.join(', ')}.\n\n` +
    `// TODO: enrich via model later — Phase 1 is a template merge of the source descriptors, not a model-generated blend.`

  return { sources, mergedTags, styleSummary }
}
