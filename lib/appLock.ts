// Access control for the signed-in app. Gating is by nFactorial incubator
// participation (asked once, stored on the profile): participants get full access
// with a lifetime draft cap; non-participants see an "unavailable" / waitlist page.

/** Where non-participants are pointed. */
export const WAITLIST_HREF = '/early-access'

/** Lifetime draft cap for incubator participants. */
export const DRAFT_LIMIT = 5

/** Staff emails (lowercase): skip the incubator question and the draft cap. */
export const STAFF_EMAILS = ['zhanabayaliya@gmail.com']

export function isStaff(email: string | null | undefined): boolean {
  if (!email) return false
  return STAFF_EMAILS.includes(email.trim().toLowerCase())
}
