// Mechanical safety net for unattended generation: an autopilot post that
// violates these is refunded and skipped, NEVER scheduled. Autopilot writes with
// the same 'post' format as the composer — these are NOT style rules, only hard
// facts of the channel: the platform's character cap (an over-limit post is an
// API rejection), no URLs (autopilot never carries a link), and the base-rules
// em-dash slop ban.

const URL_RE = /https?:\/\/|www\./i

export function validateAutopilotPost(text: string, maxLen = 280): { ok: boolean; reason?: string } {
  const t = (text ?? '').trim()
  if (!t) return { ok: false, reason: 'empty' }
  // No casing check: casing is the VOICE's (a voice that capitalizes normally
  // must come out capitalized). Em-dash stays — it's a base-rules slop ban.
  if (t.includes('—')) return { ok: false, reason: 'em-dash' }
  if (URL_RE.test(t)) return { ok: false, reason: 'url' }
  if (t.length > maxLen) return { ok: false, reason: 'too-long' }
  return { ok: true }
}
