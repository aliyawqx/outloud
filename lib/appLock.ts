// Owner/staff bypass for the signed-in app: staff accounts get unlimited credits
// and skip the trial gate. Everyone else is metered by credits — there is no
// access gate or waitlist; anyone can sign up and use the platform.

/** Staff emails (lowercase): unlimited credits, skip the trial gate. */
export const STAFF_EMAILS = ['zhanabayaliya@gmail.com']

export function isStaff(email: string | null | undefined): boolean {
  if (!email) return false
  return STAFF_EMAILS.includes(email.trim().toLowerCase())
}

/** Emails treated as EXISTING users: on signup they get a 7-day card-free window
 *  (10k credits, no Polar) instead of the card-required new-user trial gate. Add
 *  lowercase emails here, or via the CARD_FREE_TRIAL_EMAILS env (comma-separated). */
export const CARD_FREE_TRIAL_EMAILS = ['suthomemon061@gmail.com']

export function isCardFreeTrialEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  const fromEnv = (process.env.CARD_FREE_TRIAL_EMAILS ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  return CARD_FREE_TRIAL_EMAILS.includes(e) || fromEnv.includes(e)
}
