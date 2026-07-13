'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS, planDisplayName } from '@/lib/pricing'
import { PLAN_ALLOWANCE, fmtCredits } from '@/lib/creditsConfig'

// Post-purchase celebration: confetti + a "here's what you can do now" card.
// Mounted by the app home when Polar's success redirect lands with ?upgraded=
// (see /api/billing/success). Closing strips the param so it fires once.

const CONFETTI_COLORS = ['#b06bff', '#8083ff', '#ADFF2F', '#ffffff']

function ConfettiBurst() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.scale(dpr, dpr)
    const W = window.innerWidth
    const H = window.innerHeight

    type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string }
    const parts: P[] = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -6 - Math.random() * 10,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }))

    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, W, H)
      for (const p of parts) {
        p.vy += 0.25 // gravity
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = Math.max(0, 1 - t / 3.5)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      if (t < 3.5) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[95]" />
}

export function PlanWelcome({ plan }: { plan: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const meta = PLANS.find((p) => p.id === plan)
  const allowance = PLAN_ALLOWANCE[plan] ?? 0
  if (!open || !meta) return null

  function close() {
    setOpen(false)
    router.replace('/app') // strip ?upgraded= so refreshes don't re-celebrate
  }

  return (
    <>
      <ConfettiBurst />
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-8">
        <button aria-label="Close" onClick={close} className="absolute inset-0 bg-charcoal-black/70 backdrop-blur-[4px]" />
        <div className="indigo-glow relative w-full max-w-md rounded-3xl border border-electric-indigo bg-surface px-7 py-9 text-center shadow-2xl">
          <span className="rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-3 py-1 font-code-label text-code-label uppercase tracking-widest text-cyber-lime">
            You&apos;re on {planDisplayName(plan)}
          </span>
          <h2 className="mt-4 font-headline-xl text-headline-lg md:text-headline-xl">Congratulations! 🎉</h2>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            {fmtCredits(allowance)} credits just landed - you get a fresh batch on every billing date. Here&apos;s what&apos;s now yours:
          </p>
          <ul className="mx-auto mt-5 max-w-sm space-y-2.5 text-left">
            {meta.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface">
                <span aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[18px] text-cyber-lime">check_circle</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col gap-2.5">
            {plan === 'pro' && (
              <Link
                href="/app/autopilot"
                onClick={() => setOpen(false)}
                className="rounded-full bg-electric-indigo px-6 py-3 font-body-md text-body-md font-bold text-white transition-all hover:bg-primary-container active:scale-95"
              >
                Set up autopilot
              </Link>
            )}
            <button
              type="button"
              onClick={close}
              className={
                plan === 'pro'
                  ? 'rounded-full border border-border-muted px-6 py-3 font-body-md text-body-md font-bold text-on-surface transition-colors hover:border-electric-indigo'
                  : 'rounded-full bg-electric-indigo px-6 py-3 font-body-md text-body-md font-bold text-white transition-all hover:bg-primary-container active:scale-95'
              }
            >
              Start writing
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
