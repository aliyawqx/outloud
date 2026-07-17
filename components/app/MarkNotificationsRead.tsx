'use client'

import { useEffect } from 'react'

// Fire-and-forget "mark all notifications read" on mount. Lives in a client
// component so the notifications page (a Server Component) stays side-effect
// free - a router prefetch of the page must not mark anything read.
export function MarkNotificationsRead() {
  useEffect(() => {
    fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
  }, [])
  return null
}
