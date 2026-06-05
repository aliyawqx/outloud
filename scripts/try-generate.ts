// Live demo of the generation core. Run: npm run gen:demo
// Requires ANTHROPIC_API_KEY in .env.local. NOTE: this makes 2 real API calls.
import { readFileSync } from 'node:fs'
import { generateDrafts, type VoiceProfile } from '../lib/anthropic'

// Minimal .env.local loader (so we don't add a dotenv dependency).
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {
  /* no .env.local — rely on the environment */
}

// Precomputed voice (skip the captureVoice call to save tokens in the demo).
const profile: VoiceProfile = {
  summary:
    'lowercase, short lines, dry self-deprecating humor, no emoji, no hashtags, numbers over adjectives, ends mid-thought, never hypes',
  samples: [
    'lost a customer today because of a bug i shipped at 2am. lesson: stop shipping at 2am',
    'MRR is flat for the 3rd month. not panicking. ok slightly panicking',
    "rewrote the onboarding for the 4th time. this one's the one. (i have said this 4 times)",
    'spent all day on a feature nobody asked for. zero regrets',
    'support tickets down 40% after one tiny copy change. leverage is weird',
  ],
}

async function main() {
  console.log('\n════ TAKE (standalone, subtle humor) ════')
  const take = await generateDrafts(profile, {
    kind: 'take',
    input: 'shipping fast vs shipping good, as a solo founder',
    subtleHumor: true,
    count: 1,
  })
  console.log(take.drafts[0].fullText)

  console.log('\n════ REPLY (to a popular post, subtle humor) ════')
  const reply = await generateDrafts(profile, {
    kind: 'reply',
    replyTo: 'the best founders are relentlessly resourceful.',
    input: 'gently undercut the guru tone, from the trenches',
    subtleHumor: true,
    count: 1,
  })
  console.log(reply.drafts[0].fullText)
  console.log()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
