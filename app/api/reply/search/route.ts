import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getValidAccessToken } from '@/lib/x/store'
import { searchPosts } from '@/lib/x/search'
import { listProfiles } from '@/lib/voice/store'
import { isVoiceReady } from '@/lib/voice/ready'
import { judgeReplies } from '@/lib/anthropic'
import { SearchUnavailableError, XAuthError, XNotConnectedError } from '@/lib/x/errors'

// Cap the LLM judgment to the top candidates so a search never balloons cost.
const JUDGE_CAP = 18
const VERDICT_RANK = { reply: 0, maybe: 1, skip: 2 } as const

// POST /api/reply/search — discover recent high-reach posts on a topic, then judge
// each for reply-worthiness (Mode B).
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const topic = typeof (body as { topic?: unknown }).topic === 'string' ? (body as { topic: string }).topic.trim() : ''
  if (!topic) return NextResponse.json({ error: 'Tell us a topic to look for.' }, { status: 400 })

  // A ready voice is required (no generation without a voice) AND gives the judge
  // the USER_VOICE summary.
  const voice = (await listProfiles(session.userId)).find(isVoiceReady)
  if (!voice) return NextResponse.json({ error: 'Create a voice first.', needsVoice: true }, { status: 409 })

  let token: string
  try {
    token = await getValidAccessToken(session.userId)
  } catch (err) {
    if (err instanceof XNotConnectedError) return NextResponse.json({ error: 'Connect your X account to discover posts.', needsX: true }, { status: 409 })
    if (err instanceof XAuthError) return NextResponse.json({ error: 'Your X connection expired. Reconnect your X account.', needsReconnect: true }, { status: 409 })
    throw err
  }

  try {
    const candidates = await searchPosts(token, topic)
    if (candidates.length === 0) return NextResponse.json({ results: [], topic })

    const top = candidates.slice(0, JUDGE_CAP)
    const verdicts = await judgeReplies(
      top.map((p) => ({
        text: p.text,
        authorHandle: p.authorHandle,
        followers: p.followers,
        ageHours: p.ageHours,
        likes: p.likes,
        replies: p.replies,
        reposts: p.reposts,
        quotes: p.quotes,
      })),
      { topic, voiceSummary: voice.styleSummary },
    )

    const results = top
      .map((post, i) => ({ post, ...verdicts[i] }))
      // Surface reply first, then maybe, then skip; reachScore as a tiebreaker.
      .sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || b.post.reachScore - a.post.reachScore)

    return NextResponse.json({ results, topic })
  } catch (err) {
    if (err instanceof SearchUnavailableError) return NextResponse.json({ error: err.message, searchUnavailable: true }, { status: 409 })
    if (err instanceof XAuthError) return NextResponse.json({ error: 'Your X connection expired. Reconnect your X account.', needsReconnect: true }, { status: 409 })
    console.error('[reply/search] failed:', err)
    return NextResponse.json({ error: "Couldn't search right now. Try again." }, { status: 502 })
  }
}
