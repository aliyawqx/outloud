'use client'

import { useEffect, useRef, useState } from 'react'

function prefersReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Hero headline that rotates through a few phrases, each swapping with a fade +
 * slight slide. Under prefers-reduced-motion it stays on the first phrase.
 */
export function CyclingHeadline({
  phrases,
  className = '',
  interval = 3000,
}: {
  phrases: string[]
  className?: string
  interval?: number
}) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (prefersReduced() || phrases.length < 2) return
    const id = setInterval(() => setI((p) => (p + 1) % phrases.length), interval)
    return () => clearInterval(id)
  }, [phrases.length, interval])
  return (
    <span key={i} className={`cycle-in inline-block ${className}`}>
      {phrases[i]}
    </span>
  )
}

/**
 * Subtle scroll parallax: translates its child as it moves through the viewport.
 * transform-only (GPU-friendly), disabled under prefers-reduced-motion.
 */
export function Parallax({
  children,
  speed = 0.1,
  className = '',
}: {
  children: React.ReactNode
  speed?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReduced()) return
    let raf = 0
    const update = () => {
      const rect = el.getBoundingClientRect()
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * -speed
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [speed])
  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  )
}
