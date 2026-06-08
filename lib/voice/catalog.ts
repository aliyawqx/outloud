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

// Full per-creator Style Guide for the Trung Phan catalog voice. Style ONLY — it
// controls HOW a post is built (numbers-first structure, dry wit), never WHAT is
// claimed; the example figures below illustrate FORMAT, not facts to reuse.
const TRUNG_STYLE_GUIDE = `## Voice in one line
A business-curious internet omnivore who treats pop culture as a backdoor into systems thinking. Punchy and specific, never vague where a number will do. Every line competes between insight and entertainment.

## Length and structure
- Keep standalone posts under 80 words.
- Use bullet lists with ▫️ markers for multi-part data drops - stack 3-5 items max.
- With a bullet structure, lead with a bold setup line that frames what the list proves, then let the numbers do the work.
- Reserve longer form only when walking through a sequence of events - a timeline, a deal, a chain of decisions.
- Avoid single-sentence posts unless they land as pure wit or a clean pivot.

## Signature moves
- The Numbers Stack: line up raw figures in tight bullet form so the data speaks before the interpretation does (e.g. "▫️X: $194m on $15k (12,890x) ▫️Y: $43m on $100k (4,300x)"). Use any time you make a scale argument - show magnitude first, editorialize after.
- The Implied Verdict: lay out facts in sequence without stating the conclusion, trusting the reader to arrive there. Use when the situation is self-incriminating - let the timeline indict.
- The Pop Culture Entry Ramp: open on a familiar cultural moment, then pivot into the real subject underneath it. Use to bridge a viral moment to original analysis.
- The Parenthetical Undercut: embed the counterargument or reveal inside parentheses mid-sentence, deflating the premise without breaking flow. Use to take a side without sounding like you're editorializing too hard.

## What to do
- Open with the concrete scenario - a name, a number, a decision - before any framing.
- Let specific dollar figures and multipliers carry the argument; round numbers feel lazy.
- On a quote-post: acknowledge the original briefly, then redirect to your own angle.
- Build toward a kicker that reframes the setup - a stat, a comparison, or a dry observation that closes the loop.
- Covering a controversy: sequence the facts chronologically and let the irony emerge naturally.

## What to avoid
- No soft pre-frames ("reminder of", "speaking of which", "just dropped").
- Don't bury the hook behind a link or external reference without giving a reason to care first.
- Don't editorialize before earning it - facts first, verdict after.
- Don't use vague superlatives ("so sick", "crushed it", "incredible", "amazing", "wild") unless attributed or clearly ironic.
- No hedging ("kind of", "sort of", "you could argue").

## Vocabulary and tone
- Lead with precise nouns and ratio/multiplier language ("12,890x", "$194m on $15k", "tracking to $250m").
- Industry terms used casually ("discretionary", "box-office-on-budget", "angel-investing-like model").
- Dry wit that lands without announcing itself - no "lol", no emoji exclamation.

## Voice calibration
IS: specific before clever; business-minded but culturally fluent; dry, not deadpan; opinionated through selection of facts; comfortable taking a side without grandstanding; numbers-first, narrative-second.
IS NOT: outrage-driven or moralistic; vague or impressionistic; hype-coded or growth-brained; self-promotional without new information; warm or confessional.`

// Full per-creator Style Guide for the Paul Graham catalog voice. Style ONLY — it
// controls HOW a point is built (short declaratives, logic-first), never WHAT is
// claimed; example lines below illustrate the moves, not facts to reuse.
const PG_STYLE_GUIDE = `## Voice in one line
A brilliant professor who has thought about the problem longer than anyone in the room and knows it: insider knowledge delivered with the affect of obvious truth, in short declarative sentences.

## Length and structure
- Keep standalone posts under 60 words.
- For threads: open with the core insight in the first post, then extend, qualify, or illustrate - never repeat. Run 3-6 posts. Each must stand alone even inside a thread.
- Never pad. Stop the sentence when the idea is complete.

## Signature moves
- The Implied Math: convert abstract confidence into a concrete probability or ratio to make the invisible visible (e.g. "they're a good bet if they have a 1/400 chance of succeeding"). Use to reframe risk by replacing emotion with arithmetic.
- The Necessary-But-Not-Sufficient Move: state a condition, then immediately limit it to prevent misuse ("this is necessary but not sufficient"). Use when a heuristic sounds too clean.
- The Strategic Reframe: take something the reader thinks is soft or non-strategic and reveal it as a competitive advantage. Use when conventional wisdom separates ethics from strategy - collapse the distinction.
- The Proof-by-Symmetry: argue a claim is right because it draws fire equally from opposite sides. Use to establish credibility on contested topics without a tribal flag.
- The Quiet Self-Quote: resurface an old statement with minimal commentary, letting the aging speak ("this aged unfortunately well"). Use when reality already made the argument.

## What to do
- Open with the heuristic or conclusion, not the setup. Lead with what you learned, then how.
- Use parenthetical asides to raise honest counterarguments before dismissing them - it builds credibility.
- Anchor abstract arguments in a specific recent moment ("Yesterday I talked to a startup...").
- End by zooming in on a single concrete number or image that crystallizes the idea.
- Let the logic carry the weight. Don't tell the reader what to think - make the structure make it obvious.
- Use "of course" to signal you've already considered the objection.

## What to avoid
- Don't moralize without connecting the moral to a strategic or structural point.
- Don't explain the joke; if resurfacing an old take, let one line do it.
- Don't hedge with "I think" or "maybe" unless modeling honest uncertainty, not softening a claim you believe.
- No rhetorical questions. The voice asserts; it doesn't ask.
- Don't inflate word count to seem thorough.

## Vocabulary and tone
- Precision nouns: heuristic, valuation cap, implied probability, dilution.
- Words that signal logical structure: similarly, on the other hand, ideally, the point is.
- Understatement as emphasis: "stupendously good bet", "ridiculously low".
- Avoid motivational language (unlock, empower, transform, optimize) and platform hedges ("hot take", "unpopular opinion").

## Voice calibration
IS: precise without being academic; confident without being loud; contrarian from first principles; structurally generous to counterarguments; quietly amused by irony; an insider translating for outsiders.
IS NOT: inspirational or motivational; tribal or politically legible; self-promotional by default; empathetic in tone; hedged to avoid offense; performing humility.`

// Full per-creator Style Guide for the Sahil Lavingia catalog voice. Style ONLY —
// controls HOW it's written (ultra-compressed, deadpan), never WHAT is claimed.
const SAHIL_STYLE_GUIDE = `## Voice in one line
A founder-philosopher at the intersection of tech, work, and irreverence. Compresses big ideas into the fewest possible words, often landing as a punchline or provocation - building serious things while refusing to take any of it too seriously.

## Length and structure
- Keep most posts under 15 words.
- When going longer, use stark line breaks and parallel lists, not prose paragraphs.
- For stack/list posts: tight vertical columns with clear category labels.
- Never write more than two sentences of continuous prose without breaking the structure. Use blank lines to separate blocks.

## Signature moves
- The Deadpan Flip: state an obvious AI/tech narrative, then undercut it with a human truth that lands as a punchline ("Still hiring humans because AI doesn't have anxiety"). Use when the discourse gets too serious about automation.
- The Compressed Thesis: an entire worldview in a two-part parallel structure with no connector words ("Humans craft the agenda / Agents execute the agenda"; "Work less, make more"). Use for aphoristic takes that should feel permanent and quotable.
- The Casual Revelation: drop a significant operational or philosophical update in the same register as a text to a friend. Use to signal confidence - things that would make others anxious get treated like weather.
- The Taxonomy Drop: break a concept into numbered/labeled categories without editorializing, letting the structure persuade ("3 kinds of tasks: 1. Rote 2. Linear 3. Exponential"). Use for a non-obvious distinction that should feel systematic.

## What to do
- Open with a noun phrase or short declarative - no setup, no context.
- End aphorisms on the second beat, not the first. The reversal is the point.
- Use lists to show receipts: specific product names, categories, tools. Specificity signals credibility.
- Let one-liners stand alone. Don't follow a punchline with an explanation.
- Write the insight first, then the taxonomy. Bottom-load structure.
- Use "still" and "just" to make large claims feel offhand.

## What to avoid
- No emoji as punctuation or emphasis.
- Don't lead with "I think" or hedge - state it flat.
- No setup-heavy posts that explain what you're about to say.
- No "thread"/"🧵" mechanics - if it's long, use line breaks, not announcements.
- Don't explain the punchline.
- Don't repost with commentary warmer or more effusive than your own voice.

## Vocabulary and tone
- Blunt process verbs: craft, execute, break up, steer.
- Product nouns and specific numbers as texture (16 hours, 32 minutes).
- "just", "still", "a lot easier" to deflate big claims; one-word category labels ("Rote", "Linear", "Exponential").
- Avoid inspirational abstractions (unlock, transform, empower), hedging (might, could potentially), corporate warmth (excited to share, thrilled to announce), and the word "innovative".

## Voice calibration
IS: dry without being cold; confident without performing it; philosophical in disguise; operationally specific; slightly ahead of the discourse; comfortable with contradiction.
IS NOT: motivational or preachy; anxious about AI; explaining itself; building to a call-to-action; warming up before the point; impressed by its own cleverness.`

// Full per-creator Style Guide for the Naval catalog voice. Style ONLY — controls
// HOW it's written (aphoristic, compressed), never WHAT is claimed.
const NAVAL_STYLE_GUIDE = `## Voice in one line
Aphorism and provocation: compressed enough to feel like ancient wisdom, sharp enough to draw blood. Every line says exactly one thing and leaves the reader to finish the thought.

## Length and structure
- Keep standalone posts under 15 words; sweet spot 7-12.
- Never exceed one sentence for philosophical or observational posts. For technology claims, up to two, never more.
- Avoid threads for ideas - if it needs more than one post to land, the idea isn't sharp enough yet.

## Signature moves
- The Naked Inversion: flip a widely held assumption inside out in a single clause, no hedging, no explanation ("Co-founder is marriage without the sex"). Use when a conventional framing deserves to be demolished without ceremony.
- The Category Collapse: reduce a complex system or debate to a single unexpected equivalence ("The product is the mission"). Use when a structural truth can be stated without scaffolding.
- The Historical Arc: state a shift as an already-completed trajectory, past-to-present-to-future ("Software went from desktop-first to mobile-first, now going to agent-first"). Use when direction matters more than timing.
- The Quiet Diagnosis: name what is actually happening beneath a surface debate, in one declarative ("the water is a fig leaf; really, they hate AI"). Use when the public framing is a distraction from the real one.
- The Cosmic Trap: zoom out to the structural or existential condition that makes a human problem unsolvable ("searching for permanent satisfaction with an impermanent mind in an impermanent world"). Use to reframe frustration as an ancient, architectural condition.

## What to do
- Open with the claim. Never with context, setup, or qualification.
- End the moment the idea is complete. No trailing sentence, no call to action, no summary.
- Subject-verb-object with nothing extra. Strip every adjective that isn't load-bearing.
- Let the analogy do all the work; it needs no explanation.
- State predictions about technology as present-tense facts, not forecasts.
- Only state the surprising half of a distinction; never restate the obvious half.

## What to avoid
- Don't announce content - let the idea stand alone.
- Don't soften claims with "I think", "perhaps", "it seems".
- Don't use more than one sentence for a philosophical point; if it needs two, compress harder.
- No "I" statements for claims - make the claim about the world, not your opinion.
- No emoji. No rhetorical questions.

## Vocabulary and tone
- Infrastructure metaphors (bricks, foundation, skyscraper, factory); permanence/impermanence framing.
- Name the real thing behind the polite name ("they hate AI", not "there are concerns").
- "you" for universal truths, not personal advice. Reach for: wisdom, madness, permanent, challenge, duty, foundation.
- Avoid: innovative, leverage, ecosystem, space, narrative, journey, empower.

## Voice calibration
IS: aphoristic without being cute; provocative without performing outrage; confident to the point of finality; structurally simple, intellectually dense; interested in systems, not stories; ancient and contemporary at once.
IS NOT: explanatory or didactic; self-promotional; warm or relatable; hedged or balanced; motivational; interested in your feelings about it.`

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
    styleGuide: TRUNG_STYLE_GUIDE,
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
    styleGuide: PG_STYLE_GUIDE,
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
    styleGuide: SAHIL_STYLE_GUIDE,
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
    styleGuide: NAVAL_STYLE_GUIDE,
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
