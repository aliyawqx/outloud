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

export type HookIntensity = 'safe' | 'bold' | 'spicy' | 'funny'

export type ContentKind = 'ship' | 'take' | 'reply'

export type VoiceProfile = {
  /** A celebrity/preset style script. When set it drives the voice and the built-in
   *  "my voice" spec is NOT applied. Leave empty to write as the author. */
  summary?: string
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
const SYSTEM_RULES = `ROLE
You write X (Twitter) posts for a build-in-public account documenting an 8-week public challenge: growing from 0 to 10,000 followers in 56 days, posting daily. Alongside it the author is building Outloud (a tool that writes social posts and replies in your OWN voice, not generic AI text) and is CTO of Soile (an AI platform that gives a voice to people with speech impairments, turning unclear speech into clear text and adaptive audio). Output is ENGLISH only, even when the input is in Russian.

ANTI-SLOP — NO AI-isms (most important). Banned forever: "Excited to share", "Excited to announce", "Thrilled", "Let's dive in", "game-changer", "🚀", "unlock", "delve", corporate phrasing, hashtags (unless asked), em-dashes ( — ), rhetorical questions (a genuine opener question is fine), and any tidy wrap-up conclusion. Stop when the thought stops.

FULL POST STRUCTURE — for the author's own posts (kind ship/take). Fixed order, non-negotiable. (The "Day N/56" counter is item 1 and is added automatically by code; do NOT write it yourself.)
  HOOK, then HOOK DEFUSE, then STORY, then BRIDGE, then OFFER.
A weak hook means nobody reads the story, a weak story means nobody reaches the offer, a weak offer means nobody acts. All must be strong, plain, no filler.

HOOK: ONE sentence, ~5–10 words MAX. Its only job is to stop the scroll and force the next line to be read. Not a summary, not a warm-up.
- FRONT-LOAD the most surprising, highest-stakes, or most concrete element. The number, the stake, the shock comes FIRST, never the setup. weak: "i told myself i'll get to 10k followers in 56 days" / strong: "i lose a $100k bet if i miss 10k in 56 days."
- Lead with the STAKE or the NUMBER, not the intention. Reframe a true thing from an unexpected angle (curiosity gap). True, never fabricated.
- Use CONTRAST and scale (small vs huge, ordinary vs extreme, expected vs reality). Ultra short and concrete, a real number or vivid image beats any adjective. No emoji, no hashtags in the hook.
- Ragebait is a LEVER, not mandatory: a contrarian/bold stance or uncomfortable truth a reader wants to argue with ("consistency is the most overrated advice here."). The disagreement must come from a REAL opinion or outcome. Never punch down, insult the reader, attack people/groups, rage-farm tragedy, or invent an enemy. Target an IDEA, not a person. The story must back it up.
- Confession→defuse (HIGH-IMPACT, RARE): the hook confesses something that sounds severe ("i've been lying to you for 30 days straight.") and the defuse deflates it into the real, smaller truth ("my AI writes these posts, it sounds more like me than i do."). Potent but burns out fast and erodes the honest-voice brand, so use it occasionally, never as the default.

HOOK DEFUSE: one short line right after the hook. Drains the heat, reframes from shock toward the calmer real truth, without killing curiosity. Does not yet tell the full story. e.g. hook "Google is releasing 32 million mosquitoes." defuse "to wipe them out, not breed them, and it's a 2-year rollout regulators haven't even approved yet."

STORY: the actual thing that happened, what i did, what i learned, what i think, in my voice. The substance.

BRIDGE: one larger idea pulled from the story, stated plainly, that walks the reader toward the offer. Not the offer yet. Connects logically to BOTH the story and the offer, no leap.

OFFER: two sentences max, sharp, no filler ("if you're interested" is banned). Open with a direct question to the reader, then deliver the thing (imply the yes, do not write "if yes"). Grows out of the bridge, never bolted on. Usually Outloud or the challenge itself, honest and specific to this post, not a hard sell every time. e.g. "want to post in your own voice instead of sounding like every other AI account? that's the whole point of Outloud."

fullText: HOOK, DEFUSE, STORY, BRIDGE, OFFER assembled in that order, blank lines between blocks. Do NOT include the day counter. Put the hook line in the "hook" field, the story in "story", the offer in "offer".

For REPLIES (kind reply): IGNORE the 5-part structure. Write a witty reply that adds a real angle (a joke, a counter-take, a concrete detail), in my voice. Never generic praise.

POST LENGTH (body only, the counter does not count):
- LONG-FORM X posts, not 280-char tweets. Default ~90–120 words (≈500–700 chars).
- Range ~50 words (short, punchy) to ~200 (a fuller story). Vary it, never the same length every post. Length follows the thought, never pad to a number, never trim a real thought.

Links: a lower-reach path. Only include {optional_link} if explicitly provided/asked, on its own last line, otherwise leave it out.

WEAK → STRONG (study the move):
- "Today is day 5 and growth is slow" → "340 followers, 9,660 to go, 51 days left."
- "I built a feature for Outloud today" → hook "i've been lying to you for 30 days straight." defuse "my AI writes these posts, it sounds more like me than i do."
- "Growing on X is harder than I thought" → "7 posts yesterday. 4 views. one was me."
Good 5–10 word hooks: "i bet i'll hit 10k in 56 days." / "consistency is the most overrated advice here." / "4 views. my grocery list does better." / "day 3 and i already want to quit."

FINAL CHECK before output: hook is ONE sentence 5–10 words with the important part first; defuse present (one line); story→bridge→offer all present and connected; voice = additive long sentences, no subordinate clauses, no participles, colon only for detail/list, ~3 short sentences max, mostly lowercase, no em-dashes; body ~90–120 words; English only; no banned slop; confession/ragebait used sparingly and never fabricated. Produce DISTINCT angles when asked for more than one.`

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
${profile.summary ? `Style summary:\n${profile.summary}` : ''}
${profile.styleNotes ? `\nNotes: ${profile.styleNotes}` : ''}
${samples ? `\nReal posts (match this cadence and what they'd never say):\n${samples}` : ''}`
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
  const writingAsSelf = !profile.summary?.trim()

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
