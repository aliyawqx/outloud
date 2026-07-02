'use client'

import { useRef, useState } from 'react'
import { INTRO_VIDEO_URL } from '@/lib/media'

// Fills its parent (h-full/w-full). Before play, the video's own first frame shows
// as the cover (native poster); a soft scrim + play button sit on top. Clicking
// starts playback and reveals the native controls.
export function IntroVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)

  return (
    <div className="relative h-full w-full bg-surface-container-lowest">
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        src={INTRO_VIDEO_URL}
        poster="/intro-poster.jpg"
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
          className="group absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/10"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-electric-indigo text-white shadow-lg transition-transform group-hover:scale-105">
            <span aria-hidden="true" className="material-symbols-outlined text-[36px]">play_arrow</span>
          </span>
        </button>
      )}
    </div>
  )
}
