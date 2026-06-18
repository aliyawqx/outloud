// Tavily web research — invisible background knowledge for the post writer. The
// model decides when to call it (see the web_research tool); we run the search and
// hand the result back as BACKGROUND KNOWLEDGE, never as content to inject.
//
// Best-effort by design: any failure/timeout returns null and the caller proceeds
// to write WITHOUT research. Research is an enhancement, never a dependency — it
// must never block or error a post.

const TAVILY_URL = 'https://api.tavily.com/search'
// Advanced search typically takes ~3-4s but spikes past 5s under load. Give it
// real headroom so results actually come back (the post writer waits on this);
// the route's maxDuration (60s) comfortably covers up to two research rounds.
const TIMEOUT_MS = 12_000

export type ResearchResult = {
  answer: string
  snippets: { title: string; url: string; content: string }[]
}

export async function research(query: string): Promise<ResearchResult | null> {
  const key = process.env.TAVILY_API_KEY
  if (!key || !query.trim()) return null

  let res: Response
  try {
    res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query,
        search_depth: 'advanced',
        topic: 'news', // recency-weighted feed
        days: 7, // bias to the last week
        max_results: 5,
        include_answer: 'advanced', // distilled summary = the primary "knowledge"
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    console.warn('[research] tavily request failed:', (e as Error).message)
    return null // network error or timeout → write without research
  }
  if (!res.ok) {
    console.warn('[research] tavily non-ok status:', res.status)
    return null
  }

  const data = (await res.json().catch(() => null)) as
    | { answer?: string; results?: Array<{ title?: string; url?: string; content?: string }> }
    | null
  if (!data) return null

  return {
    answer: typeof data.answer === 'string' ? data.answer : '',
    snippets: (data.results ?? []).slice(0, 5).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
    })),
  }
}

/** Render research as a tool result clearly labeled background-knowledge-only. */
export function formatKnowledge(r: ResearchResult): string {
  const snippets = r.snippets
    .filter((s) => s.content || s.title)
    .map((s) => `- ${s.title}: ${s.content}`)
    .join('\n')
  return [
    '[BACKGROUND KNOWLEDGE — for your understanding only, do not quote or inject]',
    r.answer,
    snippets,
    '[END KNOWLEDGE]',
  ]
    .filter(Boolean)
    .join('\n')
}
