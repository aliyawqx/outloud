'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { TOURS, tourForRoute, type TourKey } from './tours'

// Fires onboarding tours: the global welcome once on first /app, and each page's
// mini-tour the first time that route is visited. Completion (incl. skip) persists
// to the profile via /api/onboarding/tour. Mounted once in the app shell; reacts to
// client navigations through usePathname.
export function TourController({ initialState }: { initialState: Record<string, boolean> }) {
  const pathname = usePathname()
  const doneRef = useRef<Record<string, boolean>>({ ...initialState })
  const runningRef = useRef(false)

  useEffect(() => {
    if (runningRef.current) return
    const key = tourForRoute(pathname, doneRef.current)
    if (!key) return

    // Let the page settle, then keep only steps whose target is actually present AND
    // visible (skips conditionally-rendered or off-screen/hidden targets cleanly).
    const timer = setTimeout(() => {
      const visible = (sel?: string) => {
        if (!sel) return true
        const el = document.querySelector(sel)
        return Boolean(el && (el as HTMLElement).getClientRects().length > 0)
      }
      const steps = TOURS[key].filter((s) => visible(s.element))
      if (steps.length === 0) return

      runningRef.current = true
      const persist = (k: TourKey) => {
        doneRef.current[k] = true
        fetch('/api/onboarding/tour', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tour: k }),
        }).catch(() => {})
      }

      const d = driver({
        showProgress: true,
        overlayColor: 'rgba(8, 7, 13, 0.72)',
        popoverClass: 'outloud-tour',
        nextBtnText: 'next',
        prevBtnText: 'back',
        doneBtnText: 'done',
        steps: steps.map((s) => ({
          element: s.element,
          popover: { title: s.title, description: s.description, side: s.side, align: s.align },
        })),
        // Fires on finish AND on skip (close/esc/overlay) → both mark the tour done.
        onDestroyed: () => {
          runningRef.current = false
          persist(key)
        },
      })
      d.drive()
    }, 650)

    return () => clearTimeout(timer)
  }, [pathname])

  return null
}
