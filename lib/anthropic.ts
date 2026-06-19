import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { BASE_PROMPT } from './basePrompt'
import { STYLE_ANALYSIS_PROMPT } from './stylePrompt'
import { INTAKE_PROMPT } from './intakePrompt'
import { REPLY_JUDGE_PROMPT } from './replyJudgePrompt'
import { research, formatKnowledge } from './research'

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
  /** Progress hook for the live "under the hood" feed. Called as real stages run:
   *  'context' when the model researches the web (topic = its search query),
   *  'draft' right before it starts writing, and 'polish' before the de-AI pass.
   *  Never faked — if a stage doesn't happen (e.g. no research), it's never emitted. */
  onStatus?: (e: { step: 'context' | 'draft' | 'polish'; topic?: string }) => void
}

/** Thrown when generation is attempted without any captured voice. There is no
 *  default voice: the caller must route the user to create a voice first. */
export class VoiceRequiredError extends Error {
  constructor() {
    super('A captured voice is required to generate. Create a voice first.')
    this.name = 'VoiceRequiredError'
  }
}

/** The model is rate-limited (429) or overloaded (529) after retries. Routes map
 *  this to a friendly "high demand, try again" instead of a hard error — important
 *  when many users generate at once on a low API tier. */
export class ModelBusyError extends Error {
  constructor() {
    super('The writer is busy right now. Wait a few seconds and try again.')
    this.name = 'ModelBusyError'
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
  const msg = await createMessage({
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
  | { action: 'ask'; question: string; options: string[] }
  | { action: 'write'; brief: string }

const IntakeSchema = z.object({
  // Filled FIRST so the model commits to the user's language before writing the
  // question/options — far more reliable than a free-text "match the user" rule.
  language: z.string().optional().default(''),
  action: z.enum(['ask', 'write']),
  question: z.string().optional().default(''),
  // Up to 3 tappable suggested answers for the clarifying question (empty on write).
  options: z.array(z.string()).optional().default([]),
  brief: z.string().optional().default(''),
})

const INTAKE_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    // Property order matters: `language` is first so the model detects + commits to
    // it before generating `question` and `options` (which must be in that language).
    properties: {
      language: { type: 'string' },
      action: { type: 'string', enum: ['ask', 'write'] },
      question: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      brief: { type: 'string' },
    },
    required: ['language', 'action', 'question', 'options', 'brief'],
  },
}

/**
 * Read the conversation and decide ONE of: ask a single follow-up question, or
 * write (returning a consolidated, facts-only brief for the post writer). The
 * multi-turn version of the "unclear input → ask, don't guess" rule.
 */
export async function runIntake(
  messages: ChatTurn[],
  format?: string,
  onStatus?: (e: { step: 'context'; topic?: string }) => void,
): Promise<IntakeResult> {
  const model = getModel()
  const effort = supportsEffort(model)
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: INTAKE_PROMPT, cache_control: { type: 'ephemeral' } }]
  // Hard language lock: the clarifying question AND its options must be in the
  // user's own language. Kept language-neutral on purpose - never bias toward any
  // single default (English, Russian, or otherwise); always mirror the user.
  system.push({
    type: 'text',
    text: 'LANGUAGE — do this FIRST: set the "language" field to the exact language the USER is writing in (their dominant one if they mix). Then write BOTH the "question" AND every single string in "options" in that language. The options array MUST be in the same language as "language" and "question" — never leave the options in a different language. Mirror the user whatever language that is; never default to English, never default to Russian, never default to any language other than the one the user themselves wrote in. This instruction is written in English, but that NEVER means you answer in English.',
  })
  if (format?.trim()) {
    // The output FORMAT is already chosen — intake must ask only for missing CONTENT
    // facts this format needs, never which format/platform to use.
    system.push({
      type: 'text',
      text: `The user has already chosen this OUTPUT FORMAT. Do NOT ask which format, platform, or channel to use - that is decided. Ask only for missing CONTENT facts this specific format needs, and if you already have enough, WRITE.\n\nFORMAT:\n${format.trim()}`,
    })
  }
  // Optional, model-chosen research — same tool as drafting, but far more tightly
  // gated: intake should only look things up when the topic CLEARLY hinges on recent
  // external events and that changes whether to ask or what to ask.
  const researchOn = Boolean(process.env.TAVILY_API_KEY)
  if (researchOn) system.push({ type: 'text', text: INTAKE_RESEARCH_RULES })

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }))
  let msg: Anthropic.Message
  let rounds = 0
  for (;;) {
    const offerTools = researchOn && rounds < MAX_INTAKE_RESEARCH_ROUNDS
    msg = await createMessage({
      model,
      max_tokens: 1500,
      system,
      ...(effort ? { thinking: { type: 'adaptive' as const } } : {}),
      ...(offerTools ? { tools: [WEB_RESEARCH_TOOL] } : {}),
      output_config: effort ? { effort: 'low', format: INTAKE_FORMAT } : { format: INTAKE_FORMAT },
      messages: convo,
    })
    if (msg.stop_reason !== 'tool_use') break
    convo.push({ role: 'assistant', content: msg.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue
      let out = 'No research available — decide without it.'
      if (block.name === 'web_research') {
        const query = typeof (block.input as { query?: unknown })?.query === 'string'
          ? (block.input as { query: string }).query
          : ''
        onStatus?.({ step: 'context', topic: query })
        const r = await research(query)
        if (r) out = formatKnowledge(r)
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: out })
    }
    convo.push({ role: 'user', content: toolResults })
    rounds++
  }
  const text = msg.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No content returned')
  let parsed: unknown
  try {
    parsed = JSON.parse(text.text)
  } catch {
    throw new Error('Model returned non-JSON output')
  }
  const r = IntakeSchema.parse(parsed)
  if (r.action === 'ask')
    return {
      action: 'ask',
      question: noEmDashes(r.question.trim()),
      options: r.options.map((o) => noEmDashes(o.trim())).filter(Boolean).slice(0, 3),
    }
  return { action: 'write', brief: r.brief.trim() }
}

// ── Reply-worthiness judgment (New Reply, "discover by topic") ──────────────────

export type AngleType = 'sharp take' | 'genuine question' | 'relatable reaction' | 'none'
export type ReplyVerdict = {
  index: number
  verdict: 'reply' | 'maybe' | 'skip'
  reason: string
  suggestedAngle: string
  angleType: AngleType
  confidence: number
}

/** One candidate post + its metrics, as fed to the judge. */
export type JudgePost = {
  text: string
  authorHandle: string
  followers: number
  ageHours: number
  likes: number
  replies: number
  reposts: number
  quotes: number
}

const VerdictSchema = z.object({
  verdicts: z.array(
    z.object({
      index: z.number(),
      verdict: z.enum(['reply', 'maybe', 'skip']),
      reason: z.string().optional().default(''),
      suggestedAngle: z.string().optional().default(''),
      angleType: z.enum(['sharp take', 'genuine question', 'relatable reaction', 'none']).optional().default('none'),
      confidence: z.number().optional().default(0),
    }),
  ),
})

const VERDICT_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            index: { type: 'number' },
            verdict: { type: 'string', enum: ['reply', 'maybe', 'skip'] },
            reason: { type: 'string' },
            suggestedAngle: { type: 'string' },
            angleType: { type: 'string', enum: ['sharp take', 'genuine question', 'relatable reaction', 'none'] },
            confidence: { type: 'number' },
          },
          required: ['index', 'verdict', 'reason', 'suggestedAngle', 'angleType', 'confidence'],
        },
      },
    },
    required: ['verdicts'],
  },
}

/**
 * Judge a BATCH of candidate posts: reply / maybe / skip, with the angle to take.
 * Runs AFTER the cheap reach/freshness pre-filter so we only spend a call on posts
 * that already clear the bar. Returns one verdict per input index (missing ones
 * default to a low-confidence skip, so the caller never crashes on a short reply).
 */
export async function judgeReplies(
  posts: JudgePost[],
  ctx: { topic: string; voiceSummary: string },
): Promise<ReplyVerdict[]> {
  if (posts.length === 0) return []
  const model = getModel()
  const effort = supportsEffort(model)

  const list = posts
    .map(
      (p, i) =>
        `[${i}]\nPOST: ${p.text}\nAUTHOR: @${p.authorHandle} (${p.followers} followers)\nAGE: ${p.ageHours}h ago\nENGAGEMENT: ${p.likes} likes, ${p.replies} replies, ${p.reposts} reposts, ${p.quotes} quotes`,
    )
    .join('\n\n')
  const content = `USER_TOPIC: ${ctx.topic}\nUSER_VOICE: ${ctx.voiceSummary || 'no summary available'}\n\nJudge each post below. Return one verdict object per index, preserving the index.\n\n${list}`

  const msg = await createMessage({
    model,
    max_tokens: 4000,
    system: [{ type: 'text', text: REPLY_JUDGE_PROMPT, cache_control: { type: 'ephemeral' } }],
    ...(effort ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: effort ? { effort: 'low', format: VERDICT_FORMAT } : { format: VERDICT_FORMAT },
    messages: [{ role: 'user', content }],
  })
  const text = msg.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No content returned')
  let parsed: unknown
  try {
    parsed = JSON.parse(text.text)
  } catch {
    throw new Error('Model returned non-JSON output')
  }
  const byIndex = new Map(VerdictSchema.parse(parsed).verdicts.map((v) => [v.index, v]))
  // Re-key to the input order; any post the model dropped becomes a safe skip.
  return posts.map((_, i) => {
    const v = byIndex.get(i)
    if (!v) return { index: i, verdict: 'skip' as const, reason: '', suggestedAngle: '', angleType: 'none' as const, confidence: 0 }
    return { ...v, reason: noEmDashes(v.reason), suggestedAngle: noEmDashes(v.suggestedAngle) }
  })
}

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
    // maxRetries: the SDK retries 429/529 with exponential backoff. Bump above the
    // default (2) so short bursts of concurrent generations ride out rate limits.
    client = new Anthropic({ maxRetries: Number(process.env.ANTHROPIC_MAX_RETRIES || 4) })
  }
  return client
}

// Concurrency limiter: cap how many model calls we have in flight per serverless
// instance so a spike of users doesn't fire 100 requests at the API at once (which
// just trips rate limits). Excess calls queue and run as slots free up.
const MAX_INFLIGHT = Number(process.env.ANTHROPIC_MAX_CONCURRENCY || 8)
function createLimiter(max: number) {
  let active = 0
  const queue: Array<() => void> = []
  const release = () => {
    active--
    queue.shift()?.()
  }
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active++
        fn().then(resolve, reject).finally(release)
      }
      if (active < max) start()
      else queue.push(start)
    })
  }
}
const limit = createLimiter(MAX_INFLIGHT)

/** Single seam for every model call: applies the concurrency limit (SDK handles
 *  retry/backoff), and maps an exhausted 429/529 to ModelBusyError so routes can
 *  return a friendly "try again" instead of a 500. */
function createMessage(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  return limit(async () => {
    const c = getClient()
    try {
      return await c.messages.create(params)
    } catch (err) {
      if (err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529)) {
        throw new ModelBusyError()
      }
      throw err
    }
  })
}

/**
 * Discovery (Mode B, LLM provider): use Anthropic's native web search to find
 * recent high-engagement X posts on a topic, and return their tweet URLs. We do
 * NOT trust the model's text about a tweet — the caller re-fetches each URL via
 * FxTwitter to confirm it's real and pull true metrics. Returns [] on any failure
 * so search can fall back. Note: web search is a billed server tool.
 */
export async function findTweetUrlsViaWeb(topic: string, max = 18): Promise<string[]> {
  const prompt =
    `Use web search to find recent (last ~48h), high-engagement public posts on X/Twitter about: "${topic}".\n` +
    `Prefer posts from large/active accounts with real traction.\n` +
    `Return ONLY direct post URLs, one per line, in the form https://x.com/<handle>/status/<id>. ` +
    `Up to ${max}. No commentary.`
  let msg: Anthropic.Message
  try {
    msg = await createMessage({
      model: getModel(),
      max_tokens: 1500,
      // Restrict to X so results are real tweet URLs, not articles about tweets.
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6, allowed_domains: ['x.com', 'twitter.com'] }],
      messages: [{ role: 'user', content: prompt }],
    })
  } catch {
    return []
  }
  // Scan ALL text the model emitted (answer + any inline citations) for status URLs.
  const text = msg.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n')
  const matches = text.matchAll(/https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+\/status(?:es)?\/\d{1,25}/g)
  return [...new Set([...matches].map((m) => m[0]))].slice(0, max)
}

// Optional, model-chosen web research. Declared only when TAVILY_API_KEY is set.
// The model calls it when it judges the topic needs current facts; we run Tavily
// and hand the result back as background knowledge (see lib/research.ts).
const WEB_RESEARCH_TOOL: Anthropic.Tool = {
  name: 'web_research',
  description:
    'Look up current, real-world context when the post depends on recent events, news, product ' +
    'launches, prices, statistics, or anything that may have changed lately and you are NOT confident ' +
    'about. Do NOT use for timeless, personal, or opinion topics you can already write well. Returns ' +
    'background knowledge for your understanding only — not text to quote.',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'A focused search query for the topic.' } },
    required: ['query'],
  },
}

// Appended to the system prompt only when research is available, so the model knows
// when (and when NOT) to research and that results are invisible background knowledge.
const RESEARCH_RULES = `RESEARCH (web_research tool):
- You MAY call web_research at most twice, and ONLY when the post depends on current facts you're unsure of (recent news, launches, numbers, events). For timeless, personal, or opinion posts, do NOT research — just write.
- Research is BACKGROUND KNOWLEDGE so you're accurate and current. NEVER quote it, never paste links or stats verbatim, never turn the post into a news recap. Write in the user's voice as if you simply knew this.
- If research returns nothing useful, write the best post you can without it. Research must never block the post or change its format.`

const MAX_RESEARCH_ROUNDS = 2

// Intake runs on EVERY message and must stay fast, so research here is far more
// tightly gated than during drafting: at most one lookup, only for clearly recent
// external topics, purely to sharpen the decision (ask vs write) and the question.
const INTAKE_RESEARCH_RULES = `RESEARCH (web_research tool) — use rarely:
- Call web_research AT MOST ONCE, and ONLY when the user's topic clearly hinges on RECENT EXTERNAL events (breaking news, a launch, a result, a number) AND knowing the current facts would change whether you ask a question or what you ask. For personal updates, opinions, or anything timeless, do NOT research.
- Use it only to decide: ask a sharper question, or judge that there's enough context to write. Never quote it or turn your question into a news summary.
- If nothing useful comes back, just proceed. Research must never block or slow the simple cases.`

const MAX_INTAKE_RESEARCH_ROUNDS = 1

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

  // Web research is opt-in via TAVILY_API_KEY and entirely model-chosen. When off,
  // generation behaves exactly as before (single call, no tools).
  const researchOn = Boolean(process.env.TAVILY_API_KEY)
  if (researchOn) system.push({ type: 'text', text: RESEARCH_RULES })

  // Cache breakpoint on the voice block (the largest static prefix incl. RESEARCH_RULES).
  system.push({ type: 'text', text: buildVoiceBlock(profile) })
  system[system.length - 1].cache_control = { type: 'ephemeral' }

  const model = getModel()
  const effort = supportsEffort(model)

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `LANGUAGE: write the post in the exact same language the user wrote the idea below in (if they mix languages, use their dominant one). Mirror the user - never default to English, Russian, or any language other than the idea's own. Do not translate the idea. The voice samples may be in another language; that sets tone, never the output language.\n\n${hookGuidance(hookIntensity)}\n\n${buildTask(opts, count)}`,
    },
  ]

  // Tool-use loop: the model may research a few times, then writes the final post.
  // output_config.format keeps the FINAL answer constrained to DRAFTS_FORMAT JSON
  // even alongside tools (verified). Research failures degrade silently — the model
  // gets "no research available" and writes anyway, so a post is never blocked.
  let msg: Anthropic.Message
  let rounds = 0
  let draftAnnounced = false
  for (;;) {
    const offerTools = researchOn && rounds < MAX_RESEARCH_ROUNDS
    // Announce 'draft' before the call that will WRITE the post: either tools aren't
    // offered, or a prior round already researched (so this call is the writing one).
    // This keeps the real order context → draft when research runs.
    if (!draftAnnounced && (!offerTools || rounds > 0)) {
      opts.onStatus?.({ step: 'draft' })
      draftAnnounced = true
    }
    msg = await createMessage({
      model,
      max_tokens: 8000,
      system,
      ...(effort ? { thinking: { type: 'adaptive' as const } } : {}),
      ...(offerTools ? { tools: [WEB_RESEARCH_TOOL] } : {}),
      output_config: effort ? { effort: 'medium', format: DRAFTS_FORMAT } : { format: DRAFTS_FORMAT },
      messages,
    })

    if (msg.stop_reason !== 'tool_use') break

    // Preserve the full assistant turn (incl. thinking blocks) for interleaved thinking.
    messages.push({ role: 'assistant', content: msg.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue
      let out = 'No research available — write the post without it.'
      if (block.name === 'web_research') {
        const query = typeof (block.input as { query?: unknown })?.query === 'string'
          ? (block.input as { query: string }).query
          : ''
        opts.onStatus?.({ step: 'context', topic: query }) // real research is happening now
        const r = await research(query)
        if (r) out = formatKnowledge(r)
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: out })
    }
    messages.push({ role: 'user', content: toolResults })
    rounds++
  }
  // Research was available but the model wrote on the first call without it — the
  // post is already written; flash 'draft' so the feed still records the stage.
  if (!draftAnnounced) opts.onStatus?.({ step: 'draft' })

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

  opts.onStatus?.({ step: 'polish' }) // de-AI pass: strip em-dashes and ai tells
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
