import { getProfile, listProfiles } from '@/lib/voice/store'
import { listEnabledTexts } from '@/lib/voice/samples'
import { isVoiceReady } from '@/lib/voice/ready'
import { seedText } from '@/lib/prompts/seeds'
import { generatePost } from '@/lib/voice/generate'
import type { DraftPost } from '@/lib/voice/types'

// The post we're replying to + an optional angle suggested by the judge.
export type ReplyContext = {
  text: string
  authorHandle?: string
  angle?: string
  angleType?: string
}

/** Build the reply generator's "idea": the post as context + the angle to aim at.
 *  The /reply seed (≤2 sentences, specific angle, no pitch) handles the rest. */
function buildIdea(post: ReplyContext): string {
  const by = post.authorHandle ? ` (by @${post.authorHandle})` : ''
  const angle = post.angle?.trim()
    ? `\n\nAim for this angle${post.angleType && post.angleType !== 'none' ? ` (${post.angleType})` : ''}: ${post.angle.trim()}`
    : ''
  return `The X post I'm replying to${by}:\n"""\n${post.text.trim()}\n"""${angle}\n\nWrite a reply to this post that adds a specific angle.`
}

export type ReplyVariantsResult =
  | { needsVoice: true }
  | { needsVoice: false; variants: DraftPost[]; voiceName: string; clarify: string }

/**
 * Generate 2–3 reply variants in the user's captured voice. Reuses the SAME
 * generation pipeline posts use — replies are a new entry point, not a new engine.
 * The voice is resolved exactly like the composer: the chosen profile, else the
 * first ready one; never a default. Returns needsVoice when there is no ready voice.
 */
export async function generateReplyVariants(
  userId: string,
  profileId: string | undefined,
  post: ReplyContext,
  count = 3,
): Promise<ReplyVariantsResult> {
  const profile =
    profileId && profileId.trim()
      ? await getProfile(userId, profileId)
      : (await listProfiles(userId)).find(isVoiceReady) ?? null
  if (!profile || !isVoiceReady(profile)) return { needsVoice: true }

  const samples = await listEnabledTexts(userId, profile.id, 5)
  const { drafts, clarify } = await generatePost({
    idea: buildIdea(post),
    formatText: seedText('reply'),
    voiceProfile: profile,
    samples,
    count: Math.min(3, Math.max(1, count)),
  })
  return { needsVoice: false, variants: drafts, voiceName: profile.name, clarify }
}
