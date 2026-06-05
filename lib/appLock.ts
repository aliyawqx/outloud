// "Coming soon" gate for the signed-in app. Login + registration still work,
// but the app's features are blurred behind a lock until launch. Flip to false
// to open the app for everyone.
export const APP_COMING_SOON = true

/** Where the gate sends people meanwhile. */
export const WAITLIST_HREF = '/early-access'

/** Emails that bypass the gate while APP_COMING_SOON is on (lowercase). */
export const APP_ALLOWLIST = ['zhanabayaliya@gmail.com']

/** True when this user may use the app: launch is open, or they're allowlisted. */
export function isAppUnlockedFor(email: string | null | undefined): boolean {
  if (!APP_COMING_SOON) return true
  if (!email) return false
  return APP_ALLOWLIST.includes(email.trim().toLowerCase())
}
