'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { OFFER } from '@/lib/pricing'

const START = 59 * 60 + 59 // 59:59, evergreen loop

export function CountdownBar({ sticky = false }: { sticky?: boolean }) {
  const [secs, setSecs] = useState(START)

  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s <= 0 ? START : s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <div
      className={`${sticky ? 'sticky top-0' : ''} z-[60] w-full border-b border-border-muted bg-electric-indigo/10 backdrop-blur-md`}
    >
      <div className="mx-auto flex max-w-container-max flex-wrap items-center justify-center gap-x-4 gap-y-2 px-margin-mobile py-2.5 text-center md:px-margin-desktop">
        <span className="font-body-sm text-body-sm text-on-surface">{OFFER.text}</span>
        <span
          aria-live="off"
          className="rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-3 py-0.5 font-code-label text-code-label tabular-nums text-cyber-lime"
        >
          {mm}:{ss}
        </span>
        <Link
          href={OFFER.href}
          className="rounded-full bg-electric-indigo px-4 py-1 font-code-label text-code-label font-bold text-white transition-transform active:scale-95"
        >
          {OFFER.cta}
        </Link>
      </div>
    </div>
  )
}
