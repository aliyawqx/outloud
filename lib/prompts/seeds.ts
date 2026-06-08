// Seed library of FORMAT prompts (slash commands). Each controls the STRUCTURE of
// one output type; the writer's VOICE handles tone/phrasing and the IDEA supplies
// content. These are copied per-user on first use, then fully editable.
//
// Keep every format STRUCTURE-only. The global rules (anti-slop, language,
// no-fabrication) live in BASE_PROMPT and always apply.

export type SeedPrompt = { command: string; title: string; text: string }

/** The default format used when no slash command is given. */
export const DEFAULT_COMMAND = 'post'

const POST = `FORMAT: a standard X post. The DEFAULT shape is five beats - HOOK -> HOOK DEFUSE -> STORY -> BRIDGE -> OFFER - but this is a shape, NOT a quota. The VOICE decides length and density: a terse voice may fuse or drop beats and land the whole thing in a line or two; a longer, reflective voice expands them. Always match the voice's natural length. If the voice writes very short posts, write a very short post. Never pad to fill the structure, never stretch to a word count.

The beats, when the voice uses them:
- HOOK: front-load the most surprising, highest-stakes, or most concrete element (the number, the stake, the shock) FIRST, never the setup. Always true, never fabricated. A contrarian or uncomfortable-but-true stance is a lever, not mandatory; never punch down or invent an enemy.
- HOOK DEFUSE: one short line that drains the heat and reframes toward the calmer real truth, without killing curiosity.
- STORY: the actual thing that happened - what the author did, learned, or thinks. The substance.
- BRIDGE: one larger idea pulled from the story toward the offer.
- OFFER: at most two sentences, sharp, no filler - usually the product or project the author is building (only as described in the idea), honest and specific, not a hard sell every time.

Put the post in fullText. A terse voice can collapse these into one or two short lines; do whatever the voice would actually do.`

const REPLY = `FORMAT: a reply to someone else's post (the post being replied to is in the idea). 2 sentences MAX, ideally 1. Add a real, specific angle - a sharp take, a light push-back, a concrete detail, or a genuine question. Never generic praise. No pitch and no link unless explicitly asked. Put the reply in fullText.`

const THREAD = `FORMAT: a multi-post X thread. The FIRST post is a strong, standalone hook that works on its own. Each post after it carries ONE idea and reads on its own. Do NOT add "🧵" or "1/" numbering unless asked. End on a payoff, not a recap. Put the whole thread in fullText with each post separated by a blank line.`

const ANNOUNCEMENT = `FORMAT: announce something new. Lead with WHAT is new and WHY it matters to the reader, in plain language. Then say why it's useful, then how to get it or try it. Optional one-line teaser of what's next. Sound like a person, not a press release. Put it in fullText.`

const QUOTE = `FORMAT: a quote-post reacting to a quoted post (the quoted post is in the idea). 1-2 sentences with your own sharp take. Add an angle the quoted post did NOT make - not a restatement of it. Put it in fullText.`

const HOOK = `FORMAT: generate 5 opening-line hooks for an X post about the idea. Each is ONE line, concrete, front-loading a stake, claim, or surprise that makes someone stop scrolling. No clickbait the post couldn't pay off. Put all 5 in fullText, one per line, numbered 1-5.`

export const SEED_PROMPTS: SeedPrompt[] = [
  { command: 'post', title: 'X post', text: POST },
  { command: 'reply', title: 'Reply', text: REPLY },
  { command: 'thread', title: 'Thread', text: THREAD },
  { command: 'announcement', title: 'Announcement', text: ANNOUNCEMENT },
  { command: 'quote', title: 'Quote post', text: QUOTE },
  { command: 'hook', title: '5 hooks', text: HOOK },
]

/** The seed text for a command, used as a fallback before per-user seeding runs. */
export function seedText(command: string): string | undefined {
  return SEED_PROMPTS.find((p) => p.command === command)?.text
}
