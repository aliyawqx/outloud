// Owner/staff bypass for the signed-in app: staff accounts get unlimited credits
// and skip the trial gate. Everyone else is metered by credits — there is no
// access gate or waitlist; anyone can sign up and use the platform.

/** Staff emails (lowercase): unlimited credits, skip the trial gate. */
export const STAFF_EMAILS = ['zhanabayaliya@gmail.com']

export function isStaff(email: string | null | undefined): boolean {
  if (!email) return false
  return STAFF_EMAILS.includes(email.trim().toLowerCase())
}

/** DEPRECATED: every new account now gets the card-free trial by default (see
 *  createUser), so this list no longer changes signup behavior. Kept only so any
 *  external references / env config don't break. */
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
