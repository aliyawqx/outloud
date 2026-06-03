'use client'

import { useEffect } from 'react'

/**
 * Reveals every `.reveal` element on the page as it scrolls into view
 * (fade + slide-up). Above-the-fold elements animate on load. Drop one
 * <ScrollReveal /> anywhere on the page; add `className="reveal"` (and an
 * optional inline `transitionDelay` for stagger) to anything you want animated.
 */
export function ScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (!els.length) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      els.forEach((e) => e.classList.add('in'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])

  return null
}
