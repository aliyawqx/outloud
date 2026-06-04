'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { OFFER } from '@/lib/pricing'

const TOTAL_MS = ((59 * 60 + 59) * 1000) + 999 // 59:59.999, evergreen loop

export function CountdownBar({ sticky = false }: { sticky?: boolean }) {
  const [remaining, setRemaining] = useState(TOTAL_MS)

  useEffect(() => {
    // Drive from a wall-clock end time so the ms stay accurate regardless of
    // tick jitter; ~50ms updates keep the milliseconds visibly ticking.
    let end = Date.now() + TOTAL_MS
    const id = setInterval(() => {
      let left = end - Date.now()
      if (left <= 0) {
        end = Date.now() + TOTAL_MS
        left = TOTAL_MS
      }
      setRemaining(left)
    }, 50)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')
  const ms = String(Math.floor(remaining % 1000)).padStart(3, '0')

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
          {mm}:{ss}<span className="opacity-80">.{ms}</span>
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
