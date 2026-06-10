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
 * Counts a real number up from 0 when it scrolls into view (ease-out). Under
 * prefers-reduced-motion it shows the final value immediately. Only use with real
 * numbers.
 */
export function CountUp({
  to,
  suffix = '',
  duration = 1400,
  className = '',
}: {
  to: number
  suffix?: string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [val, setVal] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReduced()) {
      setVal(to)
      return
    }
    let raf = 0
    let start = 0
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          io.unobserve(e.target)
          const step = (t: number) => {
            if (!start) start = t
            const p = Math.min((t - start) / duration, 1)
            setVal(Math.round(to * (1 - Math.pow(1 - p, 3))))
            if (p < 1) raf = requestAnimationFrame(step)
          }
          raf = requestAnimationFrame(step)
        })
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, duration])
  return (
    <span ref={ref} className={className}>
      {val}
      {suffix}
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
