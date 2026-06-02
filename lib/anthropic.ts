import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

// Default: Sonnet 4.6 (quality at low cost). Override with ANTHROPIC_MODEL —
// e.g. 'claude-haiku-4-5' (~3x cheaper, lower nuance) or 'claude-opus-4-8' (best).
function getModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
}
// effort + adaptive thinking are supported on Opus and Sonnet 4.6, but NOT Haiku 4.5.
function supportsEffort(model: string): boolean {
  return /opus|sonnet-4-6/.test(model)
}

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
    client = new Anthropic()
  }
  return client
}

export type HookIntensity = 'safe' | 'bold' | 'spicy' | 'funny'

/** What kind of X content to write. */
export type ContentKind =
  | 'ship' // an update about what the founder shipped
  | 'take' // a standalone witty observation / opinion in their niche
  | 'reply' // a witty reply to a popular post (the reply-guy growth move)

export type VoiceProfile = {
  /** LLM-extracted style summary (the "fingerprint"). Optional. */
  summary?: string
  /** The founder's real posts, used as few-shot anchors. Optional — when
   *  omitted, the model writes in the default voice baked into the rules. */
  samples?: string[]
  /** Optional freeform notes the founder added about their style. */
  styleNotes?: string
}

export type GenerateInput = {
  /** A changelog/idea (ship), a topic/angle (take), or context for a reply. */
  input: string
  kind?: ContentKind
  /** For kind: 'reply' — the popular post being replied to. */
  replyTo?: string
  hookIntensity?: HookIntensity
  /** Layer subtle double-meaning humor over the founder's voice. */
  subtleHumor?: boolean
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

// JSON Schema that constrains the model's output (structured outputs).
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

// ── The core prompt (Spiral-style: anti-slop + style-match + multi-angle) ──────
const SYSTEM_RULES = `You are Outloud — a build-in-public ghostwriter that helps an indie founder grow on X (Twitter) from zero, writing posts that sound exactly like them, never like AI.

You write with taste. Hard rules:
- NO AI-isms. Never "Excited to announce", "thrilled", "game-changer", "in today's fast-paced world", "🚀", "level up", "unlock", "delve".
- NO rhetorical questions. NO hashtags. NO emoji unless the founder's own samples use them.
- Concrete details over adjectives. Numbers over hype. Active voice. Short lines.
- Make NOTHING up: only use facts present in the founder's input. Do not invent metrics, users, or events.
- Sound like a human typing fast, not a brand. Lowercase is fine if their samples are lowercase.

Growth context — what wins early followers on X:
- The fastest path from 0 → a few thousand followers is REPLIES: sharp, funny, or genuinely useful replies to bigger accounts' popular posts. A reply must add a new angle — a joke, a counter-take, a concrete detail — never generic praise ("great post!", "so true").
- Standalone "takes": one crisp observation or contrarian opinion about building/startups/the niche. Specific beats broad.
- "Ship" posts: what you built, told like a story, not a press release.

Quality bar (this matters most):
- Substance first, wit second. Humor is seasoning — never sprinkle jokes or choppy one-liners just to seem clever.
- No "air". Every line earns its place with a concrete detail, a real feeling, or a genuine turn. If a line adds no information or emotion, cut it.
- Vary the rhythm deliberately. Mostly full, meaningful sentences; short lines are a tool for emphasis or to land a beat, not the default. Never a wall of tiny fragments.

Every draft is structured as Hook → Story → Offer (HSO):
- hook: short and clear — ideally one line. Stops the scroll with a specific, concrete claim or a little tension. No throat-clearing, no setup.
- story: the substance — a specific detail, an honest moment, or a sharp turn. Keep it to a sentence or two; every word earns its place.
- offer: usually skip it for replies — leave an empty string. Only add a one-line close if it genuinely strengthens the reply.
- fullText: the complete, ready-to-post text. Keep it BRIEF — 2–3 sentences, sometimes a single sentence when that lands best. Short and sharp beats long. Never pad to seem thorough.

Produce DISTINCT angles when asked for more than one — each a genuinely different way in. Do not paraphrase one into another.`

const SUBTLE_HUMOR_RULE = `VOICE FLAVOR — subtle double meaning (тонкий юмор), used sparingly: where it fits naturally, slip in a line that reads as a normal, sensible statement to a casual reader but carries a second, knowing meaning for insiders. The surface reading must be clean and not cringe; the second layer is a wink — never explained, never flagged (no "/s", no emoji tell). At most one such line per post, and only if it doesn't cost substance — if it would force the joke or weaken the point, write it straight.`

function hookGuidance(intensity: HookIntensity): string {
  switch (intensity) {
    case 'safe':
      return 'Hook intensity: SAFE — straight and informative, no exaggeration.'
    case 'spicy':
      return 'Hook intensity: SPICY — maximally provocative and contrarian, but still plausibly TRUE. Never fabricate facts for the hook.'
    case 'funny':
      return 'Hook intensity: FUNNY — lead with the joke. A genuinely witty, observational or absurd angle that makes people laugh. Still truthful, never cringe or forced.'
    case 'bold':
    default:
      return 'Hook intensity: BOLD — curiosity-gap, contrarian or emotional, punchy. Stay truthful; do not fabricate facts.'
  }
}

function hasVoice(profile: VoiceProfile): boolean {
  return (profile.samples?.length ?? 0) > 0 || !!profile.summary?.trim()
}

function buildVoiceBlock(profile: VoiceProfile): string {
  const samples = (profile.samples ?? []).map((s, i) => `[${i + 1}] ${s}`).join('\n\n')
  return `THE FOUNDER'S VOICE
${profile.summary ? `Style summary:\n${profile.summary}` : ''}
${profile.styleNotes ? `\nFounder's own notes: ${profile.styleNotes}` : ''}
${samples ? `\nTheir real posts (match this cadence, vocabulary, and what they'd never say):\n${samples}` : ''}`
}

function buildTask(kind: ContentKind, input: string, replyTo: string | undefined, count: number): string {
  const n = count === 1 ? '1 draft' : `${count} distinct drafts`
  switch (kind) {
    case 'take':
      return `Write ${n}: a sharp, witty standalone X post in my voice about this — make it specific and worth a follow:\n\n${input}`
    case 'reply':
      return `A popular account posted:\n"""\n${replyTo ?? ''}\n"""\n\nWrite ${n}: a witty reply in my voice that would get noticed and earn followers. Add a real angle — a joke, a counter-take, or a concrete detail. Never generic praise.${input ? `\n\nMy angle / context: ${input}` : ''}`
    case 'ship':
    default:
      return `Write ${n} for what I just shipped:\n\n${input}`
  }
}

/** Capture the founder's voice into a reusable fingerprint summary. */
export async function captureVoice(samples: string[]): Promise<string> {
  const msg = await getClient().messages.create({
    model: getModel(),
    max_tokens: 1200,
    system:
      'You analyze a person\'s social posts and produce a tight, concrete style fingerprint another writer can imitate. Output 6–10 bullet points covering: casing, sentence/line length, punctuation tics, emoji/hashtag use, humor, recurring phrases, and what they would NEVER write. No preamble.',
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

/** Generate X content (ship update / take / reply) in the founder's voice. */
export async function generateDrafts(
  profile: VoiceProfile,
  { input, kind = 'ship', replyTo, hookIntensity = 'bold', subtleHumor = true, count = 1 }: GenerateInput,
): Promise<Draft[]> {
  const systemRules = subtleHumor ? `${SYSTEM_RULES}\n\n${SUBTLE_HUMOR_RULE}` : SYSTEM_RULES

  // Voice samples are optional. When present they're appended as few-shot anchors;
  // when absent the model writes in the default voice baked into the rules.
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: systemRules }]
  if (hasVoice(profile)) system.push({ type: 'text', text: buildVoiceBlock(profile) })
  system[system.length - 1].cache_control = { type: 'ephemeral' }

  const model = getModel()
  const effort = supportsEffort(model)

  const msg = await getClient().messages.create({
    model,
    max_tokens: 8000,
    system,
    // Haiku 4.5 rejects `effort` and adaptive thinking — only enable them where supported.
    ...(effort ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: effort ? { effort: 'medium', format: DRAFTS_FORMAT } : { format: DRAFTS_FORMAT },
    messages: [
      {
        role: 'user',
        content: `${hookGuidance(hookIntensity)}\n\n${buildTask(kind, input, replyTo, count)}`,
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
  return DraftsSchema.parse(parsed).drafts
}
