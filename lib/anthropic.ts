import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { BASE_PROMPT } from './basePrompt'
import { STYLE_ANALYSIS_PROMPT } from './stylePrompt'
import { INTAKE_PROMPT } from './intakePrompt'

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
  /** Raw input: what happened / what to post about (any language). */
  input: string
  /** Revision mode: the existing draft to edit. When set, the model applies the
   *  change in `input` to this post and keeps the SAME voice, length and structure
   *  (instead of regenerating from scratch, which can drift off-voice). */
  reviseBase?: string
  /** FORMAT prompt (slash command): controls the STRUCTURE of the output. The
   *  format-agnostic BASE rules + this format drive structure; the voice governs tone. */
  formatText?: string
  hookIntensity?: HookIntensity
  /** {optional_link} — a URL to maybe include (links are a lower-reach path). */
  optionalLink?: string
  /** Optional progress-counter day (generic, user-configured). Adds a header line. */
  progressDay?: number
  /** Optional progress-counter goal/total, e.g. "Day 5/30". */
  progressTotal?: number
  /** Optional follower number for the header. */
  followerCount?: number
  /** How many drafts to return. Defaults to 1. */
  count?: number
}

/** Thrown when generation is attempted without any captured voice. There is no
 *  default voice: the caller must route the user to create a voice first. */
export class VoiceRequiredError extends Error {
  constructor() {
    super('A captured voice is required to generate. Create a voice first.')
    this.name = 'VoiceRequiredError'
  }
}

export type Draft = {
  angle: string
  hook: string
  story: string
  offer: string
  fullText: string
}

/** Either drafts, or a clarifying question when the idea was unclear (not both). */
export type GenerateResult = { drafts: Draft[]; clarify: string }

/** Hard guarantee: no long em/en dashes in generated text (use a plain hyphen). */
function noEmDashes(s: string): string {
  return s.replace(/[—–―]/g, '-')
}
function sanitizeDraft(d: Draft): Draft {
  return {
    angle: noEmDashes(d.angle),
    hook: noEmDashes(d.hook),
    story: noEmDashes(d.story),
    offer: noEmDashes(d.offer),
    fullText: noEmDashes(d.fullText),
  }
}

const DraftsSchema = z.object({
  /** When set, the idea was unclear: a question to the user (in their language), no drafts. */
  clarify: z.string().optional().default(''),
  drafts: z.array(
    z.object({
      angle: z.string(),
      hook: z.string(),
      story: z.string(),
      offer: z.string(),
      fullText: z.string(),
    }),
  ),
})

const DRAFTS_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      clarify: { type: 'string' },
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
    required: ['clarify', 'drafts'],
  },
}

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
  return `THE VOICE - THIS IS THE MOST IMPORTANT PART OF THE WHOLE TASK.
The post MUST sound like this exact writer, not like a helpful, polished, polite assistant. Commit to this voice completely and match its ATTITUDE, not a safe version of it: its edge, bluntness, sarcasm, profanity, arrogance, terseness, dryness, or warmth - exactly as the guide describes. NEVER soften, sanitize, hedge, or make it more polite, friendly, balanced, or "professional" than the guide says. If the guide says this writer is rude, blunt, cocky, or unfiltered, then BE rude, blunt, cocky, and unfiltered. Do not add reassurance, qualifiers, or niceties the writer would never use. A watered-down, generic, polite version of this voice is the single biggest failure - do not produce it. When in doubt, push the voice further, not softer.

${profile.styleGuide ? `STYLE GUIDE for this writer - this is the SPEC for their voice, and your job is to follow it. Apply every rule in it precisely and completely: its tone and attitude, its edge, its sentence architecture, its length habits, its punctuation and casing, and the things it explicitly says to avoid. This guide was built from this writer's own real posts, so treat it as binding, not as a loose suggestion. When you have finished a draft, check it against this guide rule by rule.\n${profile.styleGuide}` : ''}
${profile.summary ? `\nStyle summary:\n${profile.summary}` : ''}
${profile.styleNotes ? `\nNotes: ${profile.styleNotes}` : ''}
${samples ? `\nTHE WRITER'S REAL POSTS - concrete examples of the style guide in action, so you can see the rules above as real text. Use them to ground the guide and resolve anything it leaves unstated: match what you actually see here - their length and density, sentence shape, how they use line breaks and blank lines, their capitalization (e.g. lowercase "i" if they write it that way), their punctuation, their exact vocabulary and slang, how they OPEN a post and how they END one. Be just as concrete and specific as they are - real details, not abstract philosophizing they wouldn't write. If these posts do NOT end with a call-to-action, a "stay tuned", a teaser, a sign-off, or a hashtag, then yours must not either. Aim to write a new post that could sit unnoticed in this list - the same writer, on a different day. Never copy or quote a line; write something new in the same voice.\n\n${samples}` : ''}`
}

function buildTask(input: GenerateInput, count: number): string {
  const n = count === 1 ? '1 draft' : `${count} distinct drafts`
  const link = input.optionalLink?.trim()
  const linkLine = link
    ? `\n\n{optional_link} (links reduce reach, include only if it clearly strengthens the post, on its own last line): ${link}`
    : ''
  // Revision: edit the existing post, don't regenerate. Preserve the voice and
  // length that are already there; only fold in the requested change.
  if (input.reviseBase?.trim()) {
    return `Here is the current post, already written in the author's voice:\n"""\n${input.reviseBase.trim()}\n"""\n\nThe author wants this single change: ${input.input}\n\nRewrite the post applying ONLY that change. Keep the SAME voice, register, length, structure and rhythm as the current post - do NOT make it longer, do NOT switch to a generic or more formal style, do NOT add sections it doesn't already have. Return the revised post.${linkLine}`
  }
  // Format prompt (slash command): the FORMAT drives structure, the idea supplies
  // content, the voice (in system) handles tone.
  if (input.formatText?.trim()) {
    return `Write ${n} using the FORMAT below, in the EXACT voice described in the VOICE section.\n\nFORMAT:\n${input.formatText.trim()}\n\nThe user's idea (take ALL facts only from here, never invent anything not present):\n\n${input.input}${linkLine}\n\nReminder: commit fully to the writer's voice and its attitude/edge - do NOT produce a polished, polite, or generic version. The voice matters more than the format.`
  }
  // No format given (defensive fallback): just write from the idea in the voice.
  return `Write ${n} in the author's voice for this:\n\n${input.input}${linkLine}`
}

export type StyleGuide = { guideMarkdown: string; summary: string }

/** Pull the short summary out of the profile's "## VOICE SUMMARY" section (the
 *  first paragraph), falling back to the opening of the guide. */
function extractVoiceSummary(md: string): string {
  const m = md.match(/##\s*VOICE SUMMARY\s*\n+([\s\S]*?)(?:\n\s*##\s|$)/i)
  const body = (m ? m[1] : md).trim()
  return body.split(/\n{2,}/)[0].replace(/\s+/g, ' ').trim().slice(0, 400)
}

/**
 * THE one universal prompt. Analyze an author's samples into a structured, reusable
 * voice profile (markdown) the generation step consumes. Works for the user's own
 * samples or a third-party/celebrity's public samples, in any language.
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
    ...(effort ? { thinking: { type: 'adaptive' as const }, output_config: { effort: 'medium' as const } } : {}),
    messages: [
      {
        role: 'user',
        content: `Here are the writing samples from one author. Extract the voice profile.\n\nSAMPLES:\n\n${enabled.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}`,
      },
    ],
  })

  const block = msg.content.find((b) => b.type === 'text')
  const guide = block && block.type === 'text' ? block.text.trim() : ''
  if (!guide) throw new Error('No content returned')
  return { guideMarkdown: guide, summary: extractVoiceSummary(guide) }
}

// ── Chat intake: the multi-turn "ask vs write" decision ────────────────────────

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type IntakeResult =
  | { action: 'ask'; question: string }
  | { action: 'write'; brief: string }

const IntakeSchema = z.object({
  action: z.enum(['ask', 'write']),
  question: z.string().optional().default(''),
  brief: z.string().optional().default(''),
})

const INTAKE_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: { type: 'string', enum: ['ask', 'write'] },
      question: { type: 'string' },
      brief: { type: 'string' },
    },
    required: ['action', 'question', 'brief'],
  },
}

/**
 * Read the conversation and decide ONE of: ask a single follow-up question, or
 * write (returning a consolidated, facts-only brief for the post writer). The
 * multi-turn version of the "unclear input → ask, don't guess" rule.
 */
export async function runIntake(messages: ChatTurn[], format?: string): Promise<IntakeResult> {
  const model = getModel()
  const effort = supportsEffort(model)
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: INTAKE_PROMPT, cache_control: { type: 'ephemeral' } }]
  if (format?.trim()) {
    // The output FORMAT is already chosen — intake must ask only for missing CONTENT
    // facts this format needs, never which format/platform to use.
    system.push({
      type: 'text',
      text: `The user has already chosen this OUTPUT FORMAT. Do NOT ask which format, platform, or channel to use - that is decided. Ask only for missing CONTENT facts this specific format needs, and if you already have enough, WRITE.\n\nFORMAT:\n${format.trim()}`,
    })
  }
  const msg = await getClient().messages.create({
    model,
    max_tokens: 1500,
    system,
    ...(effort ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: effort ? { effort: 'low', format: INTAKE_FORMAT } : { format: INTAKE_FORMAT },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })
  const text = msg.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No content returned')
  let parsed: unknown
  try {
    parsed = JSON.parse(text.text)
  } catch {
    throw new Error('Model returned non-JSON output')
  }
  const r = IntakeSchema.parse(parsed)
  if (r.action === 'ask') return { action: 'ask', question: noEmDashes(r.question.trim()) }
  return { action: 'write', brief: r.brief.trim() }
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
 * Generate X content in a per-user voice. The voice is ALWAYS captured per user:
 * their own Style Guide/samples, or a chosen preset's summary/samples. There is
 * NO default/built-in voice — with no voice signal this throws VoiceRequiredError
 * and the caller routes the user to create a voice first.
 */
export async function generateDrafts(profile: VoiceProfile, opts: GenerateInput): Promise<GenerateResult> {
  const { hookIntensity = 'bold', count = 1 } = opts
  // The voice is driven entirely by the per-user signal (captured guide, preset
  // summary, or raw samples). No signal → no voice → do not generate.
  const hasVoiceSignal = Boolean(
    profile.summary?.trim() || profile.styleGuide?.trim() || profile.samples?.length,
  )
  if (!hasVoiceSignal) throw new VoiceRequiredError()

  // Global rules come from the format-agnostic BASE prompt; the structure comes
  // from the FORMAT (slash command), the tone from the voice (no global humor rule).
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: BASE_PROMPT }]

  system.push({ type: 'text', text: buildVoiceBlock(profile) })
  system[system.length - 1].cache_control = { type: 'ephemeral' }

  const model = getModel()
  const effort = supportsEffort(model)

  const msg = await getClient().messages.create({
    model,
    max_tokens: 8000,
    system,
    ...(effort ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: effort ? { effort: 'medium', format: DRAFTS_FORMAT } : { format: DRAFTS_FORMAT },
    messages: [
      {
        role: 'user',
        content: `LANGUAGE: write the post in the exact same language as the idea below. Do not translate it.\n\n${hookGuidance(hookIntensity)}\n\n${buildTask(opts, count)}`,
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
  const result = DraftsSchema.parse(parsed)

  // Unclear idea → return the clarifying ask, no drafts.
  const clarify = noEmDashes((result.clarify ?? '').trim())
  if (clarify && result.drafts.length === 0) return { drafts: [], clarify }

  const header = progressHeader(opts.progressDay, opts.progressTotal, opts.followerCount)
  const drafts = result.drafts.map((d) => {
    const clean = sanitizeDraft(d)
    // Prepend the optional progress-counter header (deterministic, never counted toward length).
    return header ? { ...clean, fullText: `${header}\n\n${clean.fullText}` } : clean
  })
  return { drafts, clarify: '' }
}

// Generic, optional progress-counter header. No hardcoded goal or framing — the
// day, the goal/total, and the follower number are all supplied by the caller
// (user-configured). Off entirely when no day is provided.
function progressHeader(day?: number, total?: number, followers?: number): string | null {
  if (day == null) return null
  const head = total != null ? `Day ${day}/${total}` : `Day ${day}`
  return followers == null ? head : `${head} · ${followers} followers`
}
