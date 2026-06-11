'use client'

import { forwardRef, useRef } from 'react'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { cn } from '@/lib/utils'

const Node = forwardRef<
  HTMLDivElement,
  { icon?: string; label: string; ring: string; iconColor?: string; mascot?: boolean; big?: boolean }
>(function Node({ icon, label, ring, iconColor, mascot, big }, ref) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        ref={ref}
        className={cn(
          'z-10 flex items-center justify-center rounded-2xl border-2',
          big ? 'h-32 w-32' : 'h-20 w-20',
          ring
        )}
      >
        {mascot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/mascot.svg" alt="" className="h-20 w-20" />
        ) : (
          <span className={cn('material-symbols-outlined text-[40px]', iconColor)}>{icon}</span>
        )}
      </div>
      <span className="font-code-label text-[13px] font-semibold text-on-surface">{label}</span>
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

  const indigo = 'border-electric-indigo/60 bg-electric-indigo/15 shadow-[0_0_28px_rgba(176,107,255,0.35)]'
  const lime = 'border-cyber-lime/60 bg-cyber-lime/15 shadow-[0_0_28px_rgba(173,255,47,0.3)]'

  return (
    <div ref={container} className="relative mx-auto flex h-[420px] w-full max-w-2xl items-center justify-between px-2 md:h-[480px] md:px-8">
      {/* inputs */}
      <div className="flex flex-col justify-center gap-7 md:gap-10">
        <Node ref={commits} icon="commit" label="commits" ring={indigo} iconColor="text-electric-indigo" />
        <Node ref={logs} icon="terminal" label="build logs" ring={indigo} iconColor="text-electric-indigo" />
        <Node ref={samples} icon="edit_note" label="your posts" ring={indigo} iconColor="text-electric-indigo" />
      </div>

      {/* voice core */}
      <div className="flex flex-col justify-center">
        <Node
          ref={voice}
          mascot
          big
          label="your voice"
          ring="border-electric-indigo bg-electric-indigo/20 shadow-[0_0_50px_rgba(176,107,255,0.6)]"
        />
      </div>

      {/* outputs */}
      <div className="flex flex-col justify-center gap-12 md:gap-16">
        <Node ref={posts} icon="send" label="posts" ring={lime} iconColor="text-cyber-lime" />
        <Node ref={replies} icon="reply" label="replies" ring={lime} iconColor="text-cyber-lime" />
      </div>

      {/* beams: inputs -> voice */}
      <AnimatedBeam containerRef={container} fromRef={commits} toRef={voice} curvature={60} duration={3} pathWidth={3} glowColor="#b06bff" />
      <AnimatedBeam containerRef={container} fromRef={logs} toRef={voice} duration={3} delay={0.5} pathWidth={3} glowColor="#b06bff" />
      <AnimatedBeam containerRef={container} fromRef={samples} toRef={voice} curvature={-60} duration={3} delay={1} pathWidth={3} glowColor="#b06bff" />

      {/* beams: voice -> outputs */}
      <AnimatedBeam
        containerRef={container}
        fromRef={voice}
        toRef={posts}
        curvature={40}
        duration={3}
        delay={0.3}
        pathWidth={3}
        pathColor="rgba(173,255,47,0.22)"
        gradientStartColor="#ADFF2F"
        gradientStopColor="#b06bff"
        glowColor="#ADFF2F"
      />
      <AnimatedBeam
        containerRef={container}
        fromRef={voice}
        toRef={replies}
        curvature={-40}
        duration={3}
        delay={0.8}
        pathWidth={3}
        pathColor="rgba(173,255,47,0.22)"
        gradientStartColor="#ADFF2F"
        gradientStopColor="#b06bff"
        glowColor="#ADFF2F"
      />
    </div>
  )
}
