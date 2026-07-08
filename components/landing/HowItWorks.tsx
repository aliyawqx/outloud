import type { ReactNode } from 'react'
import { Underline } from './Doodles'

// "How it works" - the three-step explanation (capture → profile → post). Replaces the
// old "What You Get" block. Static (no client hooks). Carries id="how" so the hero's
// "See how it works" link lands here. Colors/type use the shared design tokens.

type IconProps = { className?: string }

const ClipboardIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
    <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
    <path d="M9 12h6" /><path d="M9 16h6" />
  </svg>
)

const WaveIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12h2l2 8l4 -16l3 12l2 -6h3" />
  </svg>
)

const SendIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 14l11 -11" />
    <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />
  </svg>
)

const UploadIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 9l5 -5l5 5" /><path d="M12 4v12" />
  </svg>
)

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'purple' | 'lime' }) {
  const tones = {
    neutral: 'bg-white/5 text-on-surface-variant',
    purple: 'bg-electric-indigo/[0.12] text-electric-indigo',
    lime: 'bg-cyber-lime/10 text-cyber-lime',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${tones[tone]}`}>
      {children}
    </span>
  )
}

function StepCard({
  num,
  icon,
  title,
  desc,
  delay,
  children,
}: {
  num: string
  icon: ReactNode
  title: string
  desc: string
  delay: number
  children: ReactNode
}) {
  return (
    <div
      className="reveal rounded-2xl border border-border-muted bg-surface-container-low p-6"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-4 font-code-label text-[13px] font-medium tracking-wider text-cyber-lime">{num}</div>
      <div className="mb-4 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-electric-indigo/[0.14] text-electric-indigo">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-on-surface">{title}</h3>
      <p className="mb-[18px] text-[14.5px] leading-relaxed text-on-surface-variant">{desc}</p>
      <div className="rounded-xl border border-border-muted bg-surface-container-lowest p-3.5">{children}</div>
    </div>
  )
}

export function HowItWorks() {
  return (
    <section id="how" aria-label="how it works" className="mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop md:py-20">
      {/* reveal wrapper so the hand-drawn underline (.draw-path) animates in */}
      <div className="reveal">
        <p className="mb-[18px] font-code-label text-code-label uppercase tracking-[0.12em] text-cyber-lime">// how it works</p>
        <h2 className="mb-3.5 font-headline-lg text-headline-lg text-on-surface">
          How Outloud learns to sound like{' '}
          <span className="relative inline-block text-electric-indigo">
            you
            <Underline className="absolute -bottom-1.5 left-0 h-2 w-full text-cyber-lime" />
          </span>
          .
        </h2>
        <p className="mb-11 max-w-[540px] font-body-md text-body-md text-on-surface-variant">
          Three steps. No prompt engineering, no generic AI.
        </p>
      </div>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(270px,1fr))]">
        {/* 01 - capture */}
        <StepCard
          num="01"
          delay={0}
          icon={<ClipboardIcon className="h-[22px] w-[22px]" />}
          title="Capture your voice"
          desc="Paste a few posts you've already written, or import your recent ones. That's the whole setup."
        >
          <div className="mb-2.5 flex items-center gap-1.5 text-xs text-electric-indigo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" />
              <path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" />
            </svg>
            paste your posts
          </div>
          <p className="border-b border-border-muted py-[7px] text-xs leading-normal text-on-surface-variant">
            shipped the billing flow today. polar + neon, no stripe. took 3 hours and one panic.
          </p>
          <p className="py-[7px] text-xs leading-normal text-on-surface-variant">
            cold dm'd 50 people. 4 said yes. the math is brutal but it's math.
          </p>
          <div className="mt-2.5">
            <Pill tone="purple">
              <UploadIcon className="h-3.5 w-3.5" />
              or import from X
            </Pill>
          </div>
        </StepCard>

        {/* 02 - profile (the differentiator) */}
        <StepCard
          num="02"
          delay={110}
          icon={<WaveIcon className="h-[22px] w-[22px]" />}
          title="It builds your profile"
          desc="Outloud reads your cadence, phrasing, and quirks, then turns them into a style guide it follows every time."
        >
          <div className="mb-2.5 flex items-center gap-1.5 text-xs text-electric-indigo">
            <WaveIcon className="h-3.5 w-3.5" />
            your voice profile
          </div>
          <div className="flex flex-wrap gap-[7px]">
            {['lowercase', 'additive sentences', 'no em-dashes', 'dry close', 'short lines', 'numbers over hype'].map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>
        </StepCard>

        {/* 03 - post on tap + multi-platform */}
        <StepCard
          num="03"
          delay={220}
          icon={<SendIcon className="h-[22px] w-[22px]" />}
          title="Post on tap"
          desc="Every draft comes out on-voice, ready for X, LinkedIn, or Telegram in one click."
        >
          <div className="mb-2.5 flex items-center gap-1.5 text-xs text-electric-indigo">
            <span className="h-[7px] w-[7px] rounded-full bg-electric-indigo" />
            in your voice
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-on-surface">
            dark mode shipped. exports run 2x faster now. one missing await cost me the whole afternoon. classic.
          </p>
          <div className="flex flex-wrap items-center gap-[7px] border-t border-border-muted pt-2.5">
            <span className="mr-0.5 text-[11px] text-on-surface-variant/60">post to</span>
            <Pill>X</Pill>
            <Pill>LinkedIn</Pill>
            <Pill>Telegram</Pill>
          </div>
        </StepCard>
      </div>
    </section>
  )
}
