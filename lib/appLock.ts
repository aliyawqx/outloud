// Access control for the signed-in app. Gating is by nFactorial incubator
// participation (asked once, stored on the profile): participants get full access
// with a lifetime draft cap; non-participants are pointed to sign up.

/** Where non-participants / would-be users are pointed (waitlist removed). */
export const WAITLIST_HREF = '/signup'

/** Lifetime draft cap for incubator participants. */
export const DRAFT_LIMIT = 5

/** Staff emails (lowercase): skip the incubator question and the draft cap. */
export const STAFF_EMAILS = ['zhanabayaliya@gmail.com']

export function isStaff(email: string | null | undefined): boolean {
  if (!email) return false
  return STAFF_EMAILS.includes(email.trim().toLowerCase())
}
