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
  /** Short, structured description of how they write — the fallback the generator
   *  consumes when no full guide is set (tone, sentence length, signature moves). */
  styleDescriptor: string
  /** Optional FULL Style Guide (markdown) for this creator. When set it drives
   *  generation precisely (instead of the short descriptor). Style only — never a
   *  persona to speak as, never invented quotes attributed to the real person. */
  styleGuide?: string
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
  /** Human-readable style summary. For 'inspiration': templated from descriptors.
   *  For 'own': the short summary from the captured Style Guide. */
  styleSummary: string
  /** The full captured Style Guide (markdown). Own-voice profiles only. */
  styleGuide: string
  /** Target channel for this voice. */
  channel: Channel
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type Channel = 'x' | 'linkedin' | 'telegram'

export type SampleSource = 'x' | 'paste' | 'upload' | 'url'

/** A single ingested writing sample for own-voice capture. */
export type WritingSample = {
  id: string
  voiceProfileId: string
  source: SampleSource
  text: string
  usedInStyle: boolean
  createdAt: string
}

// ── The generation seam: the composer plugs in HERE ───────────────────────────

export type HookIntensity = 'safe' | 'bold' | 'spicy' | 'funny'

/** A generated post draft. Mirrors the structure the generation core produces. */
export type DraftPost = {
  angle: string
  hook: string
  story: string
  offer: string
  fullText: string
  /** Optional attached image (one per draft). Stored in Vercel Blob; the public URL
   *  rides on the draft and is sent to the publishers. `imageSource` records how it
   *  was added; `imageAlt` is attribution (stock) or alt text. */
  imageUrl?: string
  imageSource?: 'ai' | 'stock' | 'upload'
  imageAlt?: string
}

/** One turn of the composer chat, in restorable form (persisted with history). */
export type ChatTurnRecord =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; options?: string[] }
  | { role: 'assistant'; draft: DraftPost }

/** The X post a reply session is aimed at (Reply Studio). */
export type ReplyTarget = {
  tweetId: string
  url: string
  authorHandle: string
  text: string
}

/** A saved compose session for the History panel. */
export type HistoryEntry = {
  id: string
  voiceProfileId: string | null
  voiceName: string
  idea: string
  drafts: DraftPost[]
  /** Full chat transcript, so the session can be reopened and continued. */
  messages: ChatTurnRecord[]
  /** Set when this session is a reply: the post being replied to. Null for posts. */
  replyTo: ReplyTarget | null
  createdAt: string
}

/** Input to the post generator. */
export type GeneratePostInput = {
  /** The rough line about what the user shipped / wants to post about. */
  idea: string
  /** The voice to write in — a saved own or blended profile. */
  voiceProfile: VoiceProfile
  /** Raw enabled writing samples (3–5) as in-context anchors. */
  samples?: string[]
  /** How many distinct drafts to return (1–4). */
  count?: number
  hookIntensity?: HookIntensity
  /** Optional link to maybe include (lower-reach path). */
  link?: string
  /** Revision mode: an existing draft to edit in place (keeps voice + length). */
  reviseBase?: string
  /** FORMAT prompt text (slash command) — controls output structure. */
  formatText?: string
  /** Optional progress-counter values (generic, user-configured; off by default). */
  progressDay?: number
  progressTotal?: number
  followerCount?: number
  /** Progress hook for the live status feed — forwarded to the generation core. */
  onStatus?: (e: { step: 'context' | 'draft' | 'polish'; topic?: string }) => void
}
