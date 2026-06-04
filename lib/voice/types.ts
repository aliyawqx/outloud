// Core types for the Voice Inspiration system.
//
// GUARDRAIL: a VoiceSource is *style inspiration only*. We store a structured
// description of HOW someone writes (and short, paraphrased style references) —
// never a persona to "speak as", and never invented quotes attributed to them.
// The product's output is always the USER's own post about the USER's own idea,
// rendered in a blended style.

/** A curated creator usable as voice inspiration. Seeded, data-driven. */
export type VoiceSource = {
  id: string
  displayName: string
  /** X handle without the leading @. */
  handle: string
  avatarUrl: string
  /** Short, structured description of how they write — the part the future
   *  generator actually consumes (tone, sentence length, signature moves, topics). */
  styleDescriptor: string
  /** Free-form style tags, e.g. ['punchy', 'contrarian', 'technical']. */
  tags: string[]
  /** 1–3 SHORT, paraphrased/illustrative style references — NOT verbatim posts.
   *  See catalog.ts for the sourcing NOTE. May be empty. */
  exampleSnippets: string[]
}

/** Whether a profile is the user's own captured voice or a blend of inspirations. */
export type ProfileKind = 'own' | 'inspiration'

/** A reference from a profile to one of its source creators, with a blend weight. */
export type SourceRef = {
  sourceId: string
  /** Relative blend weight (> 0). Normalized when blending. Defaults to 1. */
  weight: number
}

/** A saved voice profile owned by a user. The canonical persisted entity. */
export type VoiceProfile = {
  id: string
  /** Opaque owner key (anonymous client id in Phase 1; real user id later). */
  ownerKey: string
  kind: ProfileKind
  name: string
  /** Source creators this profile is built from. Empty for a pure 'own' voice. */
  sources: SourceRef[]
  /** Union of the sources' tags (deduped). */
  mergedTags: string[]
  /** Human-readable hybrid style summary. Phase 1: templated from descriptors. */
  styleSummary: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ── The seam for later: generation plugs in HERE and nowhere else ──────────────

/** A generated post draft. Mirrors the structure the existing composer produces. */
export type DraftPost = {
  angle: string
  hook: string
  story: string
  offer: string
  fullText: string
}

/** Input to the (future) post generator. Everything in Phase 1 feeds `voiceProfile`. */
export type GeneratePostInput = {
  /** The rough line about what the user shipped / wants to post about. */
  idea: string
  /** The voice to write in — a saved, blended or own profile. */
  voiceProfile: VoiceProfile
  /** Optional extras the generator may use later (hook intensity, link, etc.). */
  options?: Record<string, unknown>
}
