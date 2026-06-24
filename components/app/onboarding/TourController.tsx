'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { TOURS, tourForRoute, type TourKey } from './tours'

// Fires onboarding tours: the global welcome once on first /app, then the new-post
// tour chains immediately after it (no refresh). Each page's mini-tour fires the first
// time that route is visited. Tours never switch pages on their own — a step instead
// points at the button to click, and when the user navigates the current tour tears
// down and the destination's tour starts. Completion (incl. skip) persists per tour.
export function TourController({ initialState }: { initialState: Record<string, boolean> }) {
  const pathname = usePathname()
  const doneRef = useRef<Record<string, boolean>>({ ...initialState })
  const runningRef = useRef(false)
  const activeRef = useRef<ReturnType<typeof driver> | null>(null)
  // Set when we tear a tour down because the user navigated — suppresses the
  // same-page follow-up chain so the destination route's own tour can run instead.
  const suppressChainRef = useRef(false)
  // Reassigned each render but always the same logic; the effect reads it at fire time,
  // and onDestroyed calls it recursively to chain the next same-page tour.
  const startRef = useRef<(key: TourKey) => void>(() => {})

  startRef.current = (key: TourKey) => {
    const isVisible = (sel?: string) => {
      if (!sel) return true
      const el = document.querySelector(sel)
      return Boolean(el && (el as HTMLElement).getClientRects().length > 0)
    }
    const steps = TOURS[key].filter((s) => isVisible(s.element))
    if (steps.length === 0) return

    runningRef.current = true
    const d = driver({
      showProgress: true,
      overlayColor: 'rgba(8, 7, 13, 0.72)',
      popoverClass: 'outloud-tour',
      // No skipping by clicking the dimmed area or pressing escape.
      allowClose: false,
      nextBtnText: 'next',
      prevBtnText: 'back',
      doneBtnText: 'done',
      // Replace the default "x" with a gray "skip" button in the top-right corner.
      onPopoverRender: (popover) => {
        if (popover.wrapper.querySelector('.outloud-skip')) return
        const skip = document.createElement('button')
        skip.type = 'button'
        skip.className = 'outloud-skip'
        skip.textContent = 'skip'
        skip.setAttribute('aria-label', 'Skip tour')
        skip.addEventListener('click', () => d.destroy())
        popover.wrapper.appendChild(skip)
      },
      steps: steps.map((s) => ({
        element: s.element,
        popover: { title: s.title, description: s.description, side: s.side, align: s.align },
      })),
      // Fires on finish AND on skip → both mark the tour done.
      onDestroyed: () => {
        runningRef.current = false
        activeRef.current = null
        doneRef.current[key] = true
        fetch('/api/onboarding/tour', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tour: key }),
        }).catch(() => {})

        const suppressed = suppressChainRef.current
        suppressChainRef.current = false
        if (suppressed) return
        // Chain the next same-page tour (welcome → new_post) with no refresh.
        setTimeout(() => {
          if (runningRef.current) return
          const next = tourForRoute(window.location.pathname, doneRef.current)
          if (next) startRef.current(next)
        }, 300)
      },
    })
    activeRef.current = d
    d.drive()
  }

  useEffect(() => {
    // The user navigated mid-tour (e.g. clicked the highlighted profile link). Tear the
    // current tour down without chaining; the destination route's tour starts below.
    if (runningRef.current && activeRef.current) {
      suppressChainRef.current = true
      activeRef.current.destroy()
    }
    const timer = setTimeout(() => {
      if (runningRef.current) return
      const key = tourForRoute(window.location.pathname, doneRef.current)
      if (key) startRef.current(key)
    }, 650)
    return () => clearTimeout(timer)
  }, [pathname])

  return null
}
