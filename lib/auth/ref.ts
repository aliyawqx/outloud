import { cookies } from 'next/headers'
import { REF_COOKIE_MAX_AGE_S, SIGNUP_REF_COOKIE, sanitizeRef } from './refShared'

export { REF_COOKIE_MAX_AGE_S, SIGNUP_REF_COOKIE, sanitizeRef }

/** The stored attribution ref (e.g. 'ph' from a Product Hunt landing), or null.
 *  Server-side read at signup time; sanitized again in case the cookie was
 *  tampered. Attribution must NEVER break the signup flow — any failure → null. */
export async function readSignupRef(): Promise<string | null> {
  try {
    const raw = (await cookies()).get(SIGNUP_REF_COOKIE)?.value
    return sanitizeRef(raw)
  } catch {
    return null
  }
}
