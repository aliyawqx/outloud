'use client'

import { useEffect, useState } from 'react'

// Demo slot for the voice-capture clip. The media is a placeholder swapped in later, so
// we probe for it first (HEAD) and only render the player when it actually exists —
// otherwise we render nothing and the section's 3-step text stands as the fallback. No
// broken <video> element is ever shown.
export function DemoVideo({
  src = '/demo/voice-capture.mp4',
  poster = '/demo/voice-capture-poster.jpg',
  caption = '~30s — capturing a voice from a few existing posts.',
}: {
  src?: string
  poster?: string
  caption?: string
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(src, { method: 'HEAD' })
      .then((r) => {
        if (alive && r.ok) setReady(true)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [src])

  // Until the real asset exists, render nothing — the 3-step explanation is the fallback.
  if (!ready) return null

  return (
    <figure className="reveal mx-auto mb-14 w-full max-w-3xl">
      <div className="relative aspect-video overflow-hidden rounded-3xl border border-border-muted bg-surface-container-low shadow-2xl shadow-electric-indigo/10">
        <video
          className="h-full w-full object-cover"
          controls
          playsInline
          preload="none"
          poster={poster}
        >
          <source src={src} type="video/mp4" />
          Your browser doesn’t support embedded video.
        </video>
      </div>
      <figcaption className="mt-3 text-center font-code-label text-code-label text-on-surface-variant/60">
        {caption}
      </figcaption>
    </figure>
  )
}
