import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { POST_PROMPT } from './postPrompt'
import { STYLE_ANALYSIS_PROMPT } from './stylePrompt'

// Default: Sonnet 4.6 (quality at low cost). Override with ANTHROPIC_MODEL —
// e.g. 'claude-haiku-4-5' (~3x cheaper, lower nuance) or 'claude-opus-4-8' (best).
function getModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
}
// effort + adaptive thinking are supported on Opus and Sonnet 4.6, but NOT Haiku 4.5.
function supportsEffort(model: string): boolean {
  return /opus|sonnet-4-6/.test(model)
}

export type HookIntensity = 'safe' | 'bold' | 'spicy' | 'funny'

export type ContentKind = 'ship' | 'take' | 'reply'

export type VoiceProfile = {
  /** A celebrity/preset style script. When set it drives the voice and the built-in
   *  "my voice" spec is NOT applied. Leave empty to write as the author. */
  summary?: string
  /** The captured, personalized Style Guide (markdown) for an own-voice profile.
   *  When set it drives the voice (the built-in "my voice" spec is NOT applied). */
  styleGuide?: string
  /** The author's real posts, injected for in-context anchoring. */
  samples?: string[]
  styleNotes?: string
}

export type GenerateInput = {
  /** {what_i_shipped} — raw input: what happened / what to post about (RU or EN). */
  input: string
  kind?: ContentKind
  /** For kind: 'reply' — the popular post being replied to. */
  replyTo?: string
  hookIntensity?: HookIntensity
  /** {optional_link} — a URL to maybe include (links are a lower-reach path). */
  optionalLink?: string
  subtleHumor?: boolean
  /** {day_number} — challenge day, injected by code. Adds the fixed header line. */
  challengeDay?: number
  /** {follower_count} — current follower number for the header. */
  followerCount?: number
  /** How many drafts to return. Defaults to 1. */
  count?: number
}

export type Draft = {
  angle: string
  hook: string
  story: string
  offer: string
  fullText: string
}

const DraftsSchema = z.object({
  drafts: z
    .array(
      z.object({
        angle: z.string(),
        hook: z.string(),
        story: z.string(),
        offer: z.string(),
        fullText: z.string(),
      }),
    )
    .min(1),
})

const DRAFTS_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      drafts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            angle: { type: 'string' },
            hook: { type: 'string' },
            story: { type: 'string' },
            offer: { type: 'string' },
            fullText: { type: 'string' },
          },
          required: ['angle', 'hook', 'story', 'offer', 'fullText'],
        },
      },
    },
    required: ['drafts'],
  },
}

// ── Shared rules: role, anti-slop, structure, length (system[0]) ───────────────
const SYSTEM_RULES = POST_PROMPT

// ── The author's voice (RU→EN transfer): texture, not topics (self-only) ───────
const MY_VOICE_SPEC = `WRITE IN MY VOICE. It was learned from my Russian, diary-style posts. Transfer the STYLE and REGISTER to English build-in-public/marketing content. Never output Russian, never copy diary topics, reproduce the TEXTURE of how i write.

Register: casual, unfiltered, reflective. Emotional honesty sits right next to plain facts, no apology, no polish.

Sentence architecture:
- Default to developed, flowing sentences. Let an idea unfold fully. Reflective writing, not a list of fragments.
- Build long sentences ADDITIVELY: chain clauses with commas and join with "and", "but", "also", "so", "then". Pile thoughts side by side, not nested.
- DO NOT use subordinate/complex clauses (no "which", "because", "although", "while", "since" as mid-sentence connectors). DO NOT use participial phrases ("having done X", "running late"). Every clause is a plain, complete statement that could stand alone, just linked by a comma or a conjunction.
- Colon only for: (1) a detail/clarification on the word right before it; (2) a list of homogeneous items ("three things broke today: the build, the deploy, and my will to live"). Never to link two full thoughts.
- Length follows the THOUGHT. Long when it needs room, short when it's genuinely small. Don't stretch past it, don't clip one that needs to breathe.
- Short, cut-short sentences ALLOWED but RARE (about three max per post), for emphasis, not the default.
- Open with the subject or action, no warm-up. State the fact, then keep going with the feeling or next event in the same breath.

Punctuation: minimal, commas do the work periods could. NO em-dashes ever. Ellipses for trailing uncertainty ("works on my machine… we'll see"). Parentheticals only for quick asides "(with breaks, obviously)". Mostly lowercase. Emoji rare, emotional tone only.

Vocabulary: casual contractions (rn, tbh, ngl, kinda, gonna, prob, anyway, basically). Approximations when feeling > fact ("like 2 hours", "been up 36+ hours"). Plain physical verbs (shipped, broke, fixed, survived, scrapped it). A short blunt phrase at emotional peaks ("i'm cooked", "this is a win", "absolute mess"). Concrete comparisons from body/home/daily life, never abstraction.

Tone: move between flat reportage and sudden honesty with no transition. Follow the thought to its natural end before stopping. When something's bad say it's bad, when a small thing's good let it land ("this is a win i think"). Dry self-aimed humor, no setup. Hedge rarely, only "i guess" / "i think".

VOICE TEXTURE EXAMPLES (these show sentence flow, not the full hook/defuse/bridge/offer structure):
- spent six hours today on a bug, it made no sense, i added logs everywhere and rewrote the whole function twice and got nowhere, and then i finally found it, it was one typo in a variable name. one character. ngl i'm cooked.
- shipped dark mode today, it took the whole day and i broke prod once right in the middle, classic move honestly. it works now, mostly, and we'll see how long that lasts.`

const SUBTLE_HUMOR_RULE = `VOICE FLAVOR — subtle double meaning (тонкий юмор), sparingly: where it fits, one line that reads as a normal statement to a casual reader but carries a second, knowing meaning for insiders. Never explained, never flagged. At most one per post, only if it doesn't cost substance.`

function hookGuidance(intensity: HookIntensity): string {
  switch (intensity) {
    case 'safe':
      return 'Hook intensity: SAFE (low) — straight and concrete, lead with the number/fact, no provocation.'
    case 'spicy':
      return 'Hook intensity: SPICY (high) — provocative, contrarian, an uncomfortable truth a reader wants to argue with. Still TRUE, never fabricated, never punching down.'
    case 'funny':
      return 'Hook intensity: FUNNY — lead with the joke. Dry and genuinely witty, never cringe or forced.'
    case 'bold':
    default:
      return 'Hook intensity: BOLD (medium) — curiosity gap, contrarian or high-stakes, punchy. Stay truthful.'
  }
}

function buildVoiceBlock(profile: VoiceProfile): string {
  const samples = (profile.samples ?? []).map((s, i) => `[${i + 1}] ${s}`).join('\n\n')
  return `THE VOICE TO WRITE IN
${profile.styleGuide ? `Captured Style Guide for this writer (follow it precisely):\n${profile.styleGuide}` : ''}
${profile.summary ? `\nStyle summary:\n${profile.summary}` : ''}
${profile.styleNotes ? `\nNotes: ${profile.styleNotes}` : ''}
${samples ? `\n{voice_samples} — the writer's REAL posts (anchor the texture, match this cadence and what they'd never say, do not copy or quote):\n${samples}` : ''}`
}

function voiceAnchor(samples: string[]): string {
  return `{voice_samples} — MY REAL POSTS (anchor the texture, do not copy or quote):\n${samples
    .map((s, i) => `[${i + 1}] ${s}`)
    .join('\n\n')}`
}

function buildTask(input: GenerateInput, count: number): string {
  const n = count === 1 ? '1 draft' : `${count} distinct drafts`
  const link = input.optionalLink?.trim()
  const linkLine = link
    ? `\n\n{optional_link} (links reduce reach, include only if it clearly strengthens the post, on its own last line): ${link}`
    : ''
  switch (input.kind) {
    case 'take':
      return `Write ${n}: a standalone X post in my voice (full HOOK/DEFUSE/STORY/BRIDGE/OFFER structure) about:\n\n${input.input}${linkLine}`
    case 'reply':
      return `A popular account posted:\n"""\n${input.replyTo ?? ''}\n"""\n\nWrite ${n}: a witty reply in my voice that adds a real angle. Never generic praise.${input.input ? `\n\nMy angle: ${input.input}` : ''}${linkLine}`
    case 'ship':
    default:
      return `{what_i_shipped} — write ${n} (full HOOK/DEFUSE/STORY/BRIDGE/OFFER structure) for this:\n\n${input.input}${linkLine}`
  }
}

/** Capture the author's voice into a reusable fingerprint summary. */
export async function captureVoice(samples: string[]): Promise<string> {
  const msg = await getClient().messages.create({
    model: getModel(),
    max_tokens: 1200,
    system:
      "You analyze a person's social posts and produce a tight, concrete style fingerprint another writer can imitate. Output 6–10 bullet points covering: casing, sentence/line length, punctuation tics, emoji/hashtag use, humor, recurring phrases, and what they would NEVER write. No preamble.",
    messages: [
      {
        role: 'user',
        content: `Here are the posts:\n\n${samples.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}`,
      },
    ],
  })
  const block = msg.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text.trim() : ''
}

const StyleGuideSchema = z.object({ summary: z.string(), guideMarkdown: z.string() })

const STYLE_GUIDE_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      guideMarkdown: { type: 'string' },
    },
    required: ['summary', 'guideMarkdown'],
  },
}

export type StyleGuide = { guideMarkdown: string; summary: string }

/**
 * Analyze a writer's samples into a personalized, sectioned Style Guide, driven
 * by the universal style-analysis meta-prompt. Works for any writer/language;
 * the guide is written in English. This is the engine that produces each client's
 * personalized voice prompt.
 */
export async function generateStyleGuide(samples: string[]): Promise<StyleGuide> {
  const enabled = samples.map((s) => s.trim()).filter(Boolean)
  if (!enabled.length) throw new Error('No samples to analyze')

  const model = getModel()
  const effort = supportsEffort(model)
  const msg = await getClient().messages.create({
    model,
    max_tokens: 4000,
    system: [{ type: 'text', text: STYLE_ANALYSIS_PROMPT, cache_control: { type: 'ephemeral' } }],
    ...(effort ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: effort ? { effort: 'medium', format: STYLE_GUIDE_FORMAT } : { format: STYLE_GUIDE_FORMAT },
    messages: [
      {
        role: 'user',
        content: `Writer's samples (analyze ONLY these):\n\n${enabled.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}`,
      },
    ],
  })

  const text = msg.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No content returned')
  let parsed: unknown
  try {
    parsed = JSON.parse(text.text)
  } catch {
    throw new Error('Model returned non-JSON output')
  }
  const r = StyleGuideSchema.parse(parsed)
  return { guideMarkdown: r.guideMarkdown.trim(), summary: r.summary.trim() }
}

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
    client = new Anthropic()
  }
  return client
}

/**
 * Generate X content in a voice.
 * - No preset summary  → write as the author (MY_VOICE_SPEC + my sample posts).
 * - Preset summary set → write in that celebrity/preset voice instead.
 */
export async function generateDrafts(profile: VoiceProfile, opts: GenerateInput): Promise<Draft[]> {
  const { hookIntensity = 'bold', subtleHumor = true, count = 1 } = opts
  // A captured Style Guide (or a preset summary) drives the voice; only fall back
  // to the built-in author spec when neither is present.
  const writingAsSelf = !profile.summary?.trim() && !profile.styleGuide?.trim()

  const baseRules = subtleHumor ? `${SYSTEM_RULES}\n\n${SUBTLE_HUMOR_RULE}` : SYSTEM_RULES
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: baseRules }]

  if (writingAsSelf) {
    system.push({ type: 'text', text: MY_VOICE_SPEC })
    if (profile.samples?.length) system.push({ type: 'text', text: voiceAnchor(profile.samples) })
  } else {
    system.push({ type: 'text', text: buildVoiceBlock(profile) })
  }
  system[system.length - 1].cache_control = { type: 'ephemeral' }

  const model = getModel()
  const effort = supportsEffort(model)

  const msg = await getClient().messages.create({
    model,
    max_tokens: 8000,
    system,
    ...(effort ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: effort ? { effort: 'medium', format: DRAFTS_FORMAT } : { format: DRAFTS_FORMAT },
    messages: [{ role: 'user', content: `${hookGuidance(hookIntensity)}\n\n${buildTask(opts, count)}` }],
  })

  const text = msg.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No content returned')

  let parsed: unknown
  try {
    parsed = JSON.parse(text.text)
  } catch {
    throw new Error('Model returned non-JSON output')
  }
  const drafts = DraftsSchema.parse(parsed).drafts

  // Prepend the fixed challenge-day header (deterministic, never counted toward length).
  const header = dayHeader(opts.challengeDay, opts.followerCount)
  if (!header) return drafts
  return drafts.map((d) => ({ ...d, fullText: `${header}\n\n${d.fullText}` }))
}

function dayHeader(day?: number, followers?: number): string | null {
  if (day == null) return null
  const f = followers == null ? '' : ` followers`
  if (day > 56) {
    return followers == null ? `Day ${day} · challenge done` : `Day ${day} · challenge done, ${followers}${f}`
  }
  return followers == null ? `Day ${day}/56` : `Day ${day}/56 · ${followers}${f}`
}
