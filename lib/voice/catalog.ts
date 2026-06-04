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

export const VOICE_SOURCES: VoiceSource[] = [
  {
    id: 'elon-musk',
    displayName: 'Elon Musk',
    handle: 'elonmusk',
    avatarUrl: avatar('elonmusk'),
    styleDescriptor:
      'Extremely terse and blunt. Often a single word or one short line. Total confidence, no hedging. Dry, deadpan, meme-aware humor. When longer, reasons from first principles with numbers and physics, and takes contrarian swings at conventional wisdom. Normal capitalization, no hashtags, no corporate throat-clearing.',
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
