'use client'

import { useEffect } from 'react'
import { REF_COOKIE_MAX_AGE_S, SIGNUP_REF_COOKIE, sanitizeRef } from '@/lib/auth/refShared'

// Launch attribution (?ref=ph): on first landing, persist the ref into a 30-day
// cookie so signup can attach it to the user record. First-touch: an existing
// cookie is never overwritten. Unknown/junk values are ignored for rendering —
// no redirect, no rewrite, no 404. Reads window.location in an effect (NOT
// useSearchParams) so the root layout stays fully static.
export function RefCapture() {
  useEffect(() => {
    try {
      const ref = sanitizeRef(new URLSearchParams(window.location.search).get('ref'))
      if (!ref) return
      if (document.cookie.split('; ').some((c) => c.startsWith(`${SIGNUP_REF_COOKIE}=`))) return
      document.cookie = `${SIGNUP_REF_COOKIE}=${ref}; max-age=${REF_COOKIE_MAX_AGE_S}; path=/; samesite=lax`
    } catch {
      // Attribution must never break the page.
    }
  }, [])
  return null
}
