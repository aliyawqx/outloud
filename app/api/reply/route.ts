import { NextRequest, NextResponse } from 'next/server'
import { validateReplyInput, type ReplyInput } from '@/lib/validateReply'
import { generateDrafts } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateReplyInput((body ?? {}) as ReplyInput)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { samples, replyTo, angle, hookIntensity, subtleHumor } = result.value

  try {
    const drafts = await generateDrafts(
      { summary: '', samples },
      { kind: 'reply', replyTo, input: angle ?? '', hookIntensity, subtleHumor, count: 1 },
    )
    const draft = drafts[0]
    if (!draft) {
      return NextResponse.json({ error: "Couldn't generate a reply. Try again." }, { status: 500 })
    }
    return NextResponse.json({ draft })
  } catch {
    return NextResponse.json({ error: "Couldn't generate a reply. Try again." }, { status: 500 })
  }
}
