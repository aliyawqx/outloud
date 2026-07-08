// Mechanical safety net over the autopilot FORMAT prompt (voice spec): an
// autopilot post that violates these is refunded and skipped, NEVER scheduled.
// Style rules the model must judge (rule-of-three, aphorisms) live in the
// prompt; only mechanically checkable rules are enforced here.

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
