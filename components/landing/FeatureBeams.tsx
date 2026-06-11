'use client'

import { forwardRef, useRef } from 'react'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { cn } from '@/lib/utils'

const Node = forwardRef<
  HTMLDivElement,
  { icon?: string; label: string; ring: string; iconColor?: string; mascot?: boolean; big?: boolean }
>(function Node({ icon, label, ring, iconColor, mascot, big }, ref) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        className={cn(
          'z-10 flex items-center justify-center rounded-2xl border bg-surface-container-low shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
          big ? 'h-20 w-20' : 'h-14 w-14',
          ring
        )}
      >
        {mascot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/mascot.svg" alt="" className="h-12 w-12" />
        ) : (
          <span className={cn('material-symbols-outlined', iconColor)}>{icon}</span>
        )}
      </div>
      <span className="font-code-label text-[11px] text-on-surface-variant">{label}</span>
    </div>
  )
})

export function FeatureBeams() {
  const container = useRef<HTMLDivElement>(null)
  const commits = useRef<HTMLDivElement>(null)
  const logs = useRef<HTMLDivElement>(null)
  const samples = useRef<HTMLDivElement>(null)
  const voice = useRef<HTMLDivElement>(null)
  const posts = useRef<HTMLDivElement>(null)
  const replies = useRef<HTMLDivElement>(null)

  const indigo = 'border-electric-indigo/40'
  const lime = 'border-cyber-lime/40'

  return (
    <div ref={container} className="relative mx-auto flex h-[360px] w-full max-w-2xl items-center justify-between px-2 md:h-[420px] md:px-8">
      {/* inputs */}
      <div className="flex flex-col justify-center gap-7 md:gap-10">
        <Node ref={commits} icon="commit" label="commits" ring={indigo} iconColor="text-electric-indigo" />
        <Node ref={logs} icon="terminal" label="build logs" ring={indigo} iconColor="text-electric-indigo" />
        <Node ref={samples} icon="edit_note" label="your posts" ring={indigo} iconColor="text-electric-indigo" />
      </div>

      {/* voice core */}
      <div className="flex flex-col justify-center">
        <Node ref={voice} mascot big label="your voice" ring="border-electric-indigo/60 ring-2 ring-electric-indigo/20" />
      </div>

      {/* outputs */}
      <div className="flex flex-col justify-center gap-12 md:gap-16">
        <Node ref={posts} icon="send" label="posts" ring={lime} iconColor="text-cyber-lime" />
        <Node ref={replies} icon="reply" label="replies" ring={lime} iconColor="text-cyber-lime" />
      </div>

      {/* beams: inputs -> voice */}
      <AnimatedBeam containerRef={container} fromRef={commits} toRef={voice} curvature={60} duration={4} />
      <AnimatedBeam containerRef={container} fromRef={logs} toRef={voice} duration={4} delay={0.6} />
      <AnimatedBeam containerRef={container} fromRef={samples} toRef={voice} curvature={-60} duration={4} delay={1.2} />

      {/* beams: voice -> outputs */}
      <AnimatedBeam containerRef={container} fromRef={voice} toRef={posts} curvature={40} duration={4} delay={0.3} gradientStartColor="#ADFF2F" gradientStopColor="#b06bff" />
      <AnimatedBeam containerRef={container} fromRef={voice} toRef={replies} curvature={-40} duration={4} delay={0.9} gradientStartColor="#ADFF2F" gradientStopColor="#b06bff" />
    </div>
  )
}
