'use client'
import React from 'react'
import { cn } from '@/lib/utils'

// Aceternity "lamp" effect, recolored to Outloud's brand (electric-indigo light on
// charcoal). Static (no entrance animation) — it just sits there as a light source.
function Beams() {
  return (
    <div className="relative isolate z-0 flex h-full w-full scale-y-125 items-center justify-center">
      <div
        style={{ backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))` }}
        className="absolute inset-auto right-1/2 h-56 w-[30rem] overflow-visible bg-gradient-conic from-electric-indigo via-transparent to-transparent text-white [--conic-position:from_70deg_at_center_top]"
      >
        <div className="absolute bottom-0 left-0 z-20 h-40 w-[100%] bg-charcoal-black [mask-image:linear-gradient(to_top,white,transparent)]" />
        <div className="absolute bottom-0 left-0 z-20 h-[100%] w-40 bg-charcoal-black [mask-image:linear-gradient(to_right,white,transparent)]" />
      </div>
      <div
        style={{ backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))` }}
        className="absolute inset-auto left-1/2 h-56 w-[30rem] bg-gradient-conic from-transparent via-transparent to-electric-indigo text-white [--conic-position:from_290deg_at_center_top]"
      >
        <div className="absolute bottom-0 right-0 z-20 h-[100%] w-40 bg-charcoal-black [mask-image:linear-gradient(to_left,white,transparent)]" />
        <div className="absolute bottom-0 right-0 z-20 h-40 w-[100%] bg-charcoal-black [mask-image:linear-gradient(to_top,white,transparent)]" />
      </div>
      <div className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 bg-charcoal-black blur-2xl" />
      <div className="absolute top-1/2 z-50 h-48 w-full bg-transparent opacity-10 backdrop-blur-md" />
      <div className="absolute inset-auto z-50 h-36 w-[28rem] -translate-y-1/2 rounded-full bg-electric-indigo opacity-50 blur-3xl" />
      <div className="absolute inset-auto z-30 h-36 w-64 -translate-y-[6rem] rounded-full bg-electric-indigo blur-2xl" />
      <div className="absolute inset-auto z-50 h-0.5 w-[30rem] -translate-y-[7rem] bg-electric-indigo" />
      <div className="absolute inset-auto z-40 h-44 w-full -translate-y-[12.5rem] bg-charcoal-black" />
    </div>
  )
}

/** The lamp light as a positioned backdrop — lay hero content over it (z above).
 *  Position/height via className (e.g. `top-[8rem] h-[30rem]`). */
export function LampGlow({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-x-0 top-0 z-0 h-[30rem] overflow-hidden', className)}>
      {/* Shrink the lamp on mobile so it doesn't span edge-to-edge — leaves black on
          the left/right. Full size from the `sm` breakpoint up. */}
      <div className="h-full w-full origin-top scale-[0.55] sm:scale-100">
        <Beams />
      </div>
    </div>
  )
}

/** The faithful Aceternity layout: light + a single heading lifted into the beam. */
export const LampContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div
      className={cn(
        'relative z-0 flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-charcoal-black',
        className,
      )}
    >
      <Beams />
      <div className="relative z-50 flex -translate-y-80 flex-col items-center px-5">{children}</div>
    </div>
  )
}
