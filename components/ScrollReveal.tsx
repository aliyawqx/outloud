'use client'

import { useEffect } from 'react'

/**
 * Reveals every `.reveal` element on the page as it scrolls into view
 * (fade + slide-up). Above-the-fold elements animate on load. Drop one
 * <ScrollReveal /> anywhere on the page; add `className="reveal"` (and an
 * optional inline `transitionDelay` for stagger) to anything you want animated.
 *
 * It also watches for `.reveal` elements that mount LATER (e.g. when a tab or
 * route swaps content) - without this they'd stay invisible until a reload,
 * because they weren't present when the observer first ran.
 */
export function ScrollReveal() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const noIO = typeof IntersectionObserver === 'undefined'

    // Reduced motion / no IO support: just show everything, now and as it mounts.
    if (reduce || noIO) {
      const showAll = () =>
        document.querySelectorAll<HTMLElement>('.reveal').forEach((e) => e.classList.add('in'))
      showAll()
      const mo = new MutationObserver(showAll)
      mo.observe(document.body, { childList: true, subtree: true })
      return () => mo.disconnect()
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

    const observe = (el: HTMLElement) => {
      if (!el.classList.contains('in')) io.observe(el)
    }
    document.querySelectorAll<HTMLElement>('.reveal').forEach(observe)

    // Pick up `.reveal` nodes added after mount (tab/route swaps).
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.classList.contains('reveal')) observe(node)
          node.querySelectorAll<HTMLElement>('.reveal').forEach(observe)
        })
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])

  return null
}
