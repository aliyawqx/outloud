// Mechanical safety net over the autopilot FORMAT prompt (voice spec): an
// autopilot post that violates these is refunded and skipped, NEVER scheduled.
// Style rules the model must judge (rule-of-three, aphorisms) live in the
// prompt; only mechanically checkable rules are enforced here.

const URL_RE = /https?:\/\/|www\./i

export function validateAutopilotPost(text: string, maxLen = 280): { ok: boolean; reason?: string } {
  const t = (text ?? '').trim()
  if (!t) return { ok: false, reason: 'empty' }
  if (t !== t.toLowerCase()) return { ok: false, reason: 'uppercase' }
  if (t.includes('—')) return { ok: false, reason: 'em-dash' }
  if (URL_RE.test(t)) return { ok: false, reason: 'url' }
  if (t.length > maxLen) return { ok: false, reason: 'too-long' }
  return { ok: true }
}
