'use client'

import { useRef, useState } from 'react'
import { INTRO_VIDEO_URL } from '@/lib/media'

// Fills its parent (h-full/w-full). Until started, a branded poster (mascot on a
// soft glow) covers the frame so it never shows a black box; clicking starts
// playback and reveals the native controls.
export function IntroVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)

  return (
    <div className="relative h-full w-full bg-surface-container-lowest">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={INTRO_VIDEO_URL}
        controls={started}
        playsInline
        preload="metadata"
        onPlay={() => setStarted(true)}
      />
      {!started && (
        <button
          type="button"
          aria-label="Play demo video"
          onClick={() => videoRef.current?.play()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-container-lowest"
        >
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric-indigo/15 blur-[80px]" />
          <img src="/mascot.svg" alt="" className="relative h-24 w-24" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-electric-indigo text-white shadow-lg">
            <span aria-hidden="true" className="material-symbols-outlined text-[32px]">play_arrow</span>
          </span>
          <span className="relative font-code-label text-code-label text-on-surface-variant">see it in action</span>
        </button>
      )}
    </div>
  )
}
