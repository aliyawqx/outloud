// Owner/staff bypass for the signed-in app: staff accounts get unlimited credits
// and skip the trial gate. Everyone else is metered by credits — there is no
// access gate or waitlist; anyone can sign up and use the platform.

/** Staff emails (lowercase): unlimited credits, skip the trial gate. */
export const STAFF_EMAILS = ['zhanabayaliya@gmail.com']

export function isStaff(email: string | null | undefined): boolean {
  if (!email) return false
  return STAFF_EMAILS.includes(email.trim().toLowerCase())
}
