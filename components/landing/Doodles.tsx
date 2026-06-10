// Hand-drawn decorative doodles for the landing page. All pure SVG (server-safe),
// in brand accent colors. Motion (twinkle / draw) is driven by CSS classes that
// respect prefers-reduced-motion.

export function Sparkle({ className = '', size = 22 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={`twinkle ${className}`}>
      <path
        d="M12 0c.6 6 5.4 10.8 12 12-6.6 1.2-11.4 6-12 12-.6-6-5.4-10.8-12-12C6.6 10.8 11.4 6 12 0z"
        fill="currentColor"
      />
    </svg>
  )
}

/** A curved arrow that draws itself once when its .reveal ancestor enters view. */
export function CurvedArrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden="true" className={className} fill="none">
      <path
        className="draw-path"
        style={{ ['--len' as string]: 200 }}
        d="M8 12c34 6 58 22 64 54"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="draw-path"
        style={{ ['--len' as string]: 40 }}
        d="M58 56l14 12 12-16"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Squiggle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 18" width="90" height="18" aria-hidden="true" className={className} fill="none">
      <path d="M2 9c8-9 14 9 22 0s14 9 22 0 14 9 22 0 10-5 12-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** A hand-drawn underline scribble to sit under an accented word. */
export function Underline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 16" preserveAspectRatio="none" aria-hidden="true" className={className} fill="none">
      <path
        className="draw-path"
        style={{ ['--len' as string]: 240 }}
        d="M4 11c44-7 150-9 212-3M10 14c40-4 120-5 196-2"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Soft organic blob shape that images/illustrations sit on top of. */
export function Blob({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M44.4 -62.1C56.8 -53.6 65.5 -39.5 70.6 -23.8C75.7 -8.1 77.1 9.2 71.6 23.9C66.1 38.6 53.6 50.8 39.1 59.2C24.6 67.6 8.1 72.3 -8.8 73.5C-25.7 74.7 -43 72.5 -55.6 62.8C-68.2 53.1 -76.1 35.9 -78.6 18C-81.1 0.1 -78.2 -18.6 -69.4 -33.6C-60.6 -48.6 -45.9 -59.9 -30.9 -67.4C-15.9 -74.9 -0.6 -78.6 13.6 -76.4C27.8 -74.2 32 -70.6 44.4 -62.1Z"
        transform="translate(100 100)"
      />
    </svg>
  )
}
