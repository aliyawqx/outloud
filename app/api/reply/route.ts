import { NextRequest, NextResponse } from 'next/server'
import { validateReplyInput, type ReplyInput } from '@/lib/validateReply'
import { generateDrafts, type VoiceProfile } from '@/lib/anthropic'
import { seedText } from '@/lib/prompts/seeds'
import { getPreset } from '@/lib/styles'

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

  const { samples, replyTo, angle, hookIntensity, subtleHumor, styleId } = result.value

  // A celebrity preset overrides the user's own samples; otherwise write as the user.
  const preset = styleId ? getPreset(styleId) : undefined
  const profile: VoiceProfile = preset
    ? { summary: preset.summary, samples: preset.samples }
    : { samples }

  // The reply FORMAT (structure) + the post being replied to and the angle as the idea.
  const idea = `The post I'm replying to:\n"""\n${replyTo}\n"""${angle ? `\n\nMy angle: ${angle}` : ''}`

  try {
    const { drafts, clarify } = await generateDrafts(profile, {
      input: idea,
      formatText: seedText('reply'),
      hookIntensity,
      subtleHumor,
      count: 1,
    })
    if (clarify && drafts.length === 0) {
      return NextResponse.json({ clarify })
    }
    const draft = drafts[0]
    if (!draft) {
      return NextResponse.json({ error: "Couldn't generate a reply. Try again." }, { status: 500 })
    }
    return NextResponse.json({ draft })
  } catch {
    return NextResponse.json({ error: "Couldn't generate a reply. Try again." }, { status: 500 })
  }
}
