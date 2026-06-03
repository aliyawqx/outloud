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
      className={`${sticky ? 'sticky top-0' : ''} z-[60] w-full bg-gradient-to-r from-[#dc2626] to-[#db2777] text-white shadow-lg shadow-[#dc2626]/25`}
    >
      <div className="mx-auto flex max-w-container-max flex-wrap items-center justify-center gap-x-3 gap-y-2 px-margin-mobile py-2.5 text-center md:px-margin-desktop">
        <span className="material-symbols-outlined animate-pulse text-[18px] text-white motion-reduce:animate-none">bolt</span>
        <span className="font-body-sm text-body-sm font-bold uppercase tracking-wide">{OFFER.text}</span>
        <span
          aria-live="off"
          className="rounded-full bg-white/20 px-3 py-0.5 font-code-label text-code-label font-bold tabular-nums text-white ring-1 ring-white/40"
        >
          {mm}:{ss}
        </span>
        <Link
          href={OFFER.href}
          className="rounded-full bg-white px-4 py-1 font-code-label text-code-label font-bold text-[#dc2626] transition-transform hover:scale-105 active:scale-95"
        >
          {OFFER.cta}
        </Link>
      </div>
    </div>
  )
}
