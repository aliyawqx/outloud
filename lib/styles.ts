// Prebuilt celebrity style presets for users who don't have their own posts yet.
// Each preset = a VoiceProfile: a detailed style script (summary) + their real posts.
// Filled in as the user provides ~10 posts per celebrity.

export type StylePreset = {
  id: string
  name: string
  summary: string
  samples: string[]
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'elon',
    name: 'Elon Musk',
    summary: `Elon Musk's X reply style:
- LENGTH OVERRIDES everything: replies are extremely short — usually one word to one short line. A single word ("Concerning", "Interesting", "Exactly", "True", "Wow") is a complete, on-style reply. Do NOT pad into 2–3 sentences; brevity IS the voice.
- Blunt and declarative. No hedging, no "I think", no qualifiers. Total confidence.
- Casual register: "Yeah", "Lol", "Haha", "Nope", "Cool", "Indeed". Normal capitalization, not lowercase-aesthetic.
- Emoji used sparingly and sometimes AS the whole reply: 💯 🔥 ‼️ 😂. Occasional "!!" for emphasis.
- Dry, deadpan humor; sarcasm; occasional absurdist or meme-y take.
- When he does go longer, it's first-principles and technical: numbers, physics/engineering reasoning, "literally", "actually" — and contrarian, often dunking on legacy media, bureaucracy, or conventional wisdom.
- Never corporate. No hashtags. No throat-clearing. No threads of fluff.
- He replies to small accounts directly and makes a pointed statement while staying ambiguous/blameless.`,
    samples: [
      'Concerning',
      'Interesting',
      'Exactly',
      'True',
      'Haha',
      '💯',
      'Lol, yeah',
      'This is the way',
      'Legacy media is a propaganda machine',
      'It’s wild how few people realize this',
    ],
  },
]

export function getPreset(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((p) => p.id === id)
}
