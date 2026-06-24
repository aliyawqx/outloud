'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { TOURS, tourForRoute, type TourStep } from './tours'

// Fires onboarding tours: the global welcome once on first /app, and each page's
// mini-tour the first time that route is visited. Tours can span pages — a step with
// a `route` navigates there first, and the overlay keeps the user on rails meanwhile.
// Completion (incl. skip) persists to the profile via /api/onboarding/tour.
export function TourController({ initialState }: { initialState: Record<string, boolean> }) {
  const pathname = usePathname()
  const router = useRouter()
  const doneRef = useRef<Record<string, boolean>>({ ...initialState })
  const runningRef = useRef(false)

  useEffect(() => {
    if (runningRef.current) return
    const key = tourForRoute(pathname, doneRef.current)
    if (!key) return

    const timer = setTimeout(() => {
      const isVisible = (sel?: string) => {
        if (!sel) return true
        const el = document.querySelector(sel)
        return Boolean(el && (el as HTMLElement).getClientRects().length > 0)
      }
      // Keep a step if it's on another route (validated on arrival) or its target is
      // present + visible on the current page. Drops missing same-page targets cleanly.
      const here = window.location.pathname
      const steps = TOURS[key].filter((s) => (s.route && s.route !== here ? true : isVisible(s.element)))
      if (steps.length === 0) return

      runningRef.current = true

      let d: ReturnType<typeof driver>
      // Move to step `index`, navigating first if it lives on another route and waiting
      // for its target to mount (with a timeout fallback so the tour never stalls).
      const goToStep = (index: number) => {
        const step: TourStep | undefined = steps[index]
        if (!step) {
          d.destroy()
          return
        }
        if (step.route && step.route !== window.location.pathname) {
          router.push(step.route)
          const start = Date.now()
          const poll = () => {
            if (isVisible(step.element) || Date.now() - start > 4000) d.moveTo(index)
            else setTimeout(poll, 120)
          }
          setTimeout(poll, 200)
        } else {
          d.moveTo(index)
        }
      }

      d = driver({
        showProgress: true,
        overlayColor: 'rgba(8, 7, 13, 0.72)',
        popoverClass: 'outloud-tour',
        // No skipping by clicking the dimmed area or pressing escape — the only way out
        // is the explicit "skip" button injected below.
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
        // We drive navigation manually (so steps can change route), so the buttons
        // delegate to goToStep instead of the default move.
        onNextClick: () => {
          const i = d.getActiveIndex() ?? 0
          if (i >= steps.length - 1) d.destroy()
          else goToStep(i + 1)
        },
        onPrevClick: () => {
          const i = d.getActiveIndex() ?? 0
          if (i > 0) goToStep(i - 1)
        },
        // Fires on finish AND on skip (close/esc/overlay) → both mark the tour done.
        onDestroyed: () => {
          runningRef.current = false
          doneRef.current[key] = true
          fetch('/api/onboarding/tour', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tour: key }),
          }).catch(() => {})
        },
      })
      d.drive()
    }, 650)

    return () => clearTimeout(timer)
  }, [pathname, router])

  return null
}
