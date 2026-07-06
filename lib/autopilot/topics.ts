// Curated topic suggestions for the autopilot interests input (pure,
// client-safe). Shown as tap-to-add chips while the user types.

export const SUGGESTED_TOPICS = [
  'building in public',
  'indie hacking',
  'ai tools',
  'ai agents',
  'saas growth',
  'startup lessons',
  'founder life',
  'product launches',
  'product design',
  'product management',
  'marketing',
  'content creation',
  'personal branding',
  'community building',
  'growth hacking',
  'bootstrapping',
  'fundraising',
  'developer tools',
  'web development',
  'machine learning',
  'open source',
  'no-code',
  'ux design',
  'remote work',
  'productivity',
  'b2b sales',
  'pricing strategy',
  'customer discovery',
  'mvp building',
  'side projects',
  'engineering leadership',
  'tech trends',
] as const

/** Topics matching the query (substring, case-insensitive), minus already-added ones. */
export function matchTopics(query: string, exclude: string[] = [], limit = 5): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const ex = new Set(exclude.map((e) => e.trim().toLowerCase()))
  return SUGGESTED_TOPICS.filter((t) => t.includes(q) && !ex.has(t)).slice(0, limit)
}
