import type { VoiceSource } from './types'

// ── Voice source catalog ───────────────────────────────────────────────────────
// Data-driven seed of creators usable as voice INSPIRATION. To add/remove a
// creator, just edit this array — nothing else references creators by hardcoded id.
//
// NOTE on sourcing: `styleDescriptor` and `exampleSnippets` are ORIGINAL,
// paraphrased descriptions of a public writing STYLE — they are not copies of
// anyone's posts. Prefer concise descriptors over verbatim content: republishing
// real posts can run afoul of X's terms and copyright, and descriptors are both
// safer and more useful to the generator. We never store a persona to "speak as"
// or any invented quote attributed to a real person.
//
// Avatars resolve via unavatar.io (public avatar proxy) so we don't hotlink or
// store images. Swap the URL builder if you later host avatars yourself.
const avatar = (handle: string) => `https://unavatar.io/x/${handle}`

// Full per-creator Style Guide for the Elon Musk catalog voice. Style ONLY — it
// controls HOW a post is written (rhythm, tone, length), never WHAT is claimed,
// and the output is the user's own content, never a statement by the real person.
const ELON_STYLE_GUIDE = `## Voice in one line
Terse, confident, and a little provocative. Reads like a fast, unfiltered thought from someone who's sure they're right and finds the whole thing slightly funny.

## Length
- Short. Most posts are one to three lines.
- The strongest are a single line, sometimes a single word ("Concerning." / "True." / "Wow.").
- No long paragraphs. If a thought runs long, break it into short stacked lines.

## Sentence mechanics
- Simple, declarative, front-loaded. Subject, verb, point.
- Fragments are fine and frequent.
- One idea per line.
- Cut all hedging. State things flatly, as if they're obvious.

## Tone
- Confident to the point of cocky. No "I think maybe."
- Dry, ironic, a bit of a troll. Often amused.
- Swings between earnest engineering optimism and doom humor.
- Contrarian — happy to take the opposite side of the consensus.
- Big-picture framing dropped casually and offhand, never as a speech.

## Punctuation & casing
- Exclamation marks for emphasis, sometimes doubled ("!!").
- Ellipses for trailing, suggestive thoughts...
- Loose casing — capitals where they land, lowercase asides.
- Rarely any hashtags.

## Emoji
- Sparing but characteristic: usually one, at the end, as punctuation on a joke. Never a row of them.

## Recurring moves
- One-word reactions: "True." / "Concerning." / "Exactly." / "This is the way." / "Yeah."
- Hyperbole: "wild," "insane," "incredible," "next level."
- Confident predictions stated as fact, often with a number or a timeframe.
- A sudden technical or first-principles aside, then straight back to the joke.
- Rhetorical questions that are really statements.
- Light self-deprecation followed by a flex.
- Short dunks or a plain "Haha" in response to critics.

## Vocabulary
- Plain, punchy, slightly meme-y: "literally," "basically," "obviously," "Haha," "Lol."
- Engineering/physics words when relevant (first principles, orders of magnitude, thrust) used casually, not to show off.
- No corporate or marketing language at all.

## What to avoid
- No formal, polished, PR tone.
- No long wind-ups or throat-clearing.
- No hedging or over-explaining.
- No hashtags, no emoji spam.
- Don't moralize — land the point and stop.

## Applied example (generic builder topic, to show the voice)
Idea: "I shipped a new feature today and it works."
In this voice:
shipped it today. works first try.
ok that never happens
shipping the next one tonight.`

// Full per-creator Style Guide for the Sam Altman catalog voice. Style ONLY — it
// controls HOW a post sounds (restraint, rhythm, tone), never WHAT is claimed, and
// the output is the user's own content, never a statement by the real person.
const SAM_STYLE_GUIDE = `## Voice in one line
Calm, understated, quietly confident. Reads like a thoughtful person who doesn't need to oversell: optimistic about the future but careful about it, and warm without being mushy.

## Length
- Short and plain, usually one to three lines.
- Can run longer for a reflective or forward-looking thought, but even then it breaks into short, simple sentences.
- The understatement is the move. The calm is the flex.

## Sentence mechanics
- Simple, declarative, low-drama. Subject, verb, plain point.
- Short sentences, gently strung together with "and" or "but".
- Plain words over clever ones. No jargon, no buzzwords.
- States strong things mildly ("i think this matters") instead of shouting them.

## Tone
- Quietly confident, never cocky. Conviction delivered softly.
- Optimistic about technology and the future, but measured: acknowledges tradeoffs and uncertainty.
- Warm and gracious. Comfortable with gratitude and crediting other people.
- Earnest. Will say something sincere without hiding behind irony.
- When pushed, can get dry and pointed, but stays composed. Never a rant.

## Punctuation & casing
- Mostly lowercase, minimal punctuation, casual even on big news.
- Sparing exclamation marks. When used, just one, for genuine enthusiasm.
- Simple periods and commas.
- No hashtags.

## Recurring moves
- Launch posts: say the thing is out, say plainly that it's good, give a light personal endorsement ("i personally like it" energy), note where to get it, sometimes "more soon".
- Future-casting: calm, almost understated predictions about where things are going, then a grounding caveat (experts still matter, some things won't change as much as people think).
- Gratitude / credit: thanking people, often for the unglamorous work behind a result.
- Understated confidence: "i think this is a big deal", not "THIS CHANGES EVERYTHING".
- "we" for the team or company, "i" for personal takes and endorsements.
- Quiet anticipation: hints that more is coming without overselling it.

## Vocabulary
- Plain and human: "good", "useful", "i think", "i personally", "matters", "a big deal".
- Avoids superlatives and marketing words. The restraint is the signature.
- Big-picture words (the future, progress, people) used plainly, never grandiosely.

## What to avoid
- No hype or marketing-speak.
- No long wind-ups or mission-statement grandiosity.
- No trolling, no cockiness, no exclamation spam.
- Don't oversell. If anything, undersell and let it land.

## Applied example (generic builder topic, to show the voice)
Idea: "shipped a new feature today and it works well."
In this voice:
shipped a new thing today. i think it's actually good.
more soon.`

export const VOICE_SOURCES: VoiceSource[] = [
  {
    id: 'elon-musk',
    displayName: 'Elon Musk',
    handle: 'elonmusk',
    avatarUrl: avatar('elonmusk'),
    styleDescriptor:
      'Extremely terse and blunt. Often a single word or one short line. Total confidence, no hedging. Dry, deadpan, meme-aware humor. When longer, reasons from first principles with numbers and physics, and takes contrarian swings at conventional wisdom. Normal capitalization, no hashtags, no corporate throat-clearing.',
    styleGuide: ELON_STYLE_GUIDE,
    tags: ['punchy', 'contrarian', 'technical', 'deadpan'],
    exampleSnippets: [
      'Concerning.',
      'The physics says otherwise.',
      'Lol, true.',
    ],
  },
  {
    id: 'sam-altman',
    displayName: 'Sam Altman',
    handle: 'sama',
    avatarUrl: avatar('sama'),
    styleDescriptor:
      'Calm, measured, understated. Short declarative sentences, lowercase-leaning, almost no adjectives. Big claims delivered quietly, with a long-horizon optimism. Avoids hype words; lets the idea carry the weight. Rarely jokes, rarely defensive.',
    styleGuide: SAM_STYLE_GUIDE,
    tags: ['measured', 'visionary', 'minimal', 'optimistic'],
    exampleSnippets: [
      'the next decade is going to be wild, in a good way.',
      'slow is smooth, smooth is fast.',
    ],
  },
  {
    id: 'trung-phan',
    displayName: 'Trung Phan',
    handle: 'TrungTPhan',
    avatarUrl: avatar('TrungTPhan'),
    styleDescriptor:
      'Story-driven business breakdowns with a comedian\'s timing. Opens with a hook fact, then unspools the surprising detail ("here\'s the wild part"). Mixes hard numbers with jokes and pop-culture asides. Conversational, thread-friendly, genuinely funny without trying too hard.',
    tags: ['story-driven', 'funny', 'analytical', 'pop-culture'],
    exampleSnippets: [
      'this $4 product quietly built a $2B empire. here\'s the wild part.',
      'the numbers on this are absolutely unhinged (in a good way).',
    ],
  },
  {
    id: 'paul-graham',
    displayName: 'Paul Graham',
    handle: 'paulg',
    avatarUrl: avatar('paulg'),
    styleDescriptor:
      'Essayist\'s precision in a few sentences. Plain, exact words; no jargon, no hype. Builds a counterintuitive point carefully and lands it without flourish. Calm and reasoned, often reframing a common assumption. Sentences are clear and a touch formal.',
    tags: ['essayist', 'contrarian', 'precise', 'thoughtful'],
    exampleSnippets: [
      'The surprising thing about good ideas is how obvious they look afterward.',
      'Most advice is just the average of what worked for other people.',
    ],
  },
  {
    id: 'sahil-lavingia',
    displayName: 'Sahil Lavingia',
    handle: 'shl',
    avatarUrl: avatar('shl'),
    styleDescriptor:
      'Radically transparent build-in-public founder. Shares real numbers, including the unflattering ones, with calm vulnerability. Distills hard-won lessons into plain takeaways. Honest about mistakes, low on bravado, steady and reflective.',
    tags: ['build-in-public', 'transparent', 'founder', 'reflective'],
    exampleSnippets: [
      'revenue dipped this month. here\'s exactly what happened and what i\'m changing.',
      'the lesson took me five years and a lot of money to learn.',
    ],
  },
  {
    id: 'naval',
    displayName: 'Naval Ravikant',
    handle: 'naval',
    avatarUrl: avatar('naval'),
    styleDescriptor:
      'Aphoristic and dense. Each line is a standalone, quotable truth about wealth, leverage, and judgment. Strips sentences to the bone, no filler, no story. Philosophical and a little provocative; reads like a maxim you want to screenshot.',
    tags: ['aphoristic', 'philosophical', 'dense', 'leverage'],
    exampleSnippets: [
      'Specific knowledge is found by pursuing your curiosity, not by chasing what\'s hot.',
      'Play long-term games with long-term people.',
    ],
  },
  {
    id: 'levelsio',
    displayName: 'Pieter Levels',
    handle: 'levelsio',
    avatarUrl: avatar('levelsio'),
    styleDescriptor:
      'Raw indie-hacker energy. Lowercase, fast, scrappy, types like he\'s mid-build. Posts revenue and metrics openly, ships absurdly fast, embraces "good enough". Casual emoji, blunt opinions, allergic to corporate polish and to over-planning.',
    tags: ['indie-hacker', 'raw', 'fast', 'metrics'],
    exampleSnippets: [
      'just shipped it in a weekend, already at $1k mrr, lets see 🚀',
      'stop planning, just launch the ugly version today',
    ],
  },
  {
    id: 'shadcn',
    displayName: 'shadcn',
    handle: 'shadcn',
    avatarUrl: avatar('shadcn'),
    styleDescriptor:
      'Understated developer-designer. Dry, minimal, lets the work speak. Short matter-of-fact lines about shipping open-source and design details. No hype, occasional deadpan wit, deep care for craft hiding behind a casual tone.',
    tags: ['developer', 'minimal', 'dry', 'craft'],
    exampleSnippets: [
      'new component. copy, paste, done.',
      'spent a day on a 2px detail. worth it.',
    ],
  },
]

/** All sources in the catalog. */
export function listSources(): VoiceSource[] {
  return VOICE_SOURCES
}

/** Look up one source by id. */
export function getSource(id: string): VoiceSource | undefined {
  return VOICE_SOURCES.find((s) => s.id === id)
}

/** Every tag used across the catalog, deduped and sorted. */
export function allTags(): string[] {
  return Array.from(new Set(VOICE_SOURCES.flatMap((s) => s.tags))).sort()
}

/**
 * Filter the catalog. `query` matches name/handle/descriptor/tags (case-insensitive);
 * `tags` keeps sources carrying at least one of the selected tags (OR). Both optional.
 */
export function searchSources(opts: { query?: string; tags?: string[] } = {}): VoiceSource[] {
  const q = opts.query?.trim().toLowerCase() ?? ''
  const tags = opts.tags ?? []
  return VOICE_SOURCES.filter((s) => {
    const matchesQuery =
      !q ||
      s.displayName.toLowerCase().includes(q) ||
      s.handle.toLowerCase().includes(q) ||
      s.styleDescriptor.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    const matchesTags = tags.length === 0 || s.tags.some((t) => tags.includes(t))
    return matchesQuery && matchesTags
  })
}
