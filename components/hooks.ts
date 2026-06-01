'use client'

import { useEffect, useRef, useState } from 'react'

/** Scroll-reveal: attach the returned ref to a container; any `.reveal`
 *  descendant (or the container itself) fades in when it enters the viewport. */
export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const els: Element[] = el.matches?.('.reveal')
      ? [el]
      : Array.from(el.querySelectorAll('.reveal'))
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    els.forEach((n, i) => {
      ;(n as HTMLElement).style.transitionDelay = (i % 6) * 60 + 'ms'
      io.observe(n)
    })
    return () => io.disconnect()
  }, [])
  return ref
}

/** Eased count-up from 0 to `target` once `run` flips true. */
export function useCountUp(target: number, run: boolean, dur = 1300) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) {
      setV(0)
      return
    }
    let raf = 0
    let start: number | undefined
    const tick = (t: number) => {
      if (start === undefined) start = t
      const p = Math.min(1, (t - start) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(target * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, dur])
  return v
}
