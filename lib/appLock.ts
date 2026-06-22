// Owner/staff bypass for the signed-in app: staff accounts get unlimited credits
// and skip the trial gate. Everyone else is metered by credits — there is no
// access gate or waitlist; anyone can sign up and use the platform.

/** Staff emails (lowercase): unlimited credits, skip the trial gate. */
export const STAFF_EMAILS = ['zhanabayaliya@gmail.com']

export function isStaff(email: string | null | undefined): boolean {
  if (!email) return false
  return STAFF_EMAILS.includes(email.trim().toLowerCase())
}

/** Emails that get a comped 7-day trial (10k credits) on signup WITHOUT a card —
 *  they skip the card wall and start with the trial pool. Add lowercase emails here,
 *  or via the TRIAL_COMP_EMAILS env (comma-separated). */
export const COMP_TRIAL_EMAILS = ['suthomemon061@gmail.com']

export function isCompTrialEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  const fromEnv = (process.env.TRIAL_COMP_EMAILS ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  return COMP_TRIAL_EMAILS.includes(e) || fromEnv.includes(e)
}
