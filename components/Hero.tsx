'use client'

import { useReveal } from './hooks'
import { GenerationDemo } from './GenerationDemo'

export function Hero() {
  const ref = useReveal<HTMLElement>()
  return (
    <section id="top" className="section" style={{ paddingTop: 70, paddingBottom: 100 }} ref={ref}>
      <div className="wrap">
        <div className="reveal row center gap-12" style={{ marginBottom: 28, flexWrap: 'wrap' }}>
          <span className="tag tag--accent">
            <span className="dot dot--live" /> 6 of 10 early-access spots left · first 10 founders $20/mo
          </span>
          <span className="tag mono">for indie SaaS founders, $1k–10k MRR</span>
        </div>
        <h1 className="reveal h-hero" style={{ maxWidth: '16ch', marginBottom: 26 }}>
          Build in public.
          <br />
          Stay consistent.
          <br />
          Get <span className="accent">known.</span>
        </h1>
        <p className="reveal lede" style={{ marginBottom: 34, fontSize: 21 }}>
          You hate marketing. You post in bursts, get 3 likes, go quiet for 6 months. Outloud turns what you{' '}
          <span style={{ color: 'var(--text)' }}>ship</span> into X posts that sound like
          <span style={{ color: 'var(--text)' }}> you</span> — approved in 30 seconds, posted, measured.
        </p>
        <div className="reveal row center gap-16" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <a href="#claim" className="btn btn--primary">
            get early access <span aria-hidden>→</span>
          </a>
          <a href="#how" className="btn btn--ghost">
            see it write ↓
          </a>
        </div>
        <div className="reveal mono" style={{ fontSize: 13, color: 'var(--faint)' }}>
          no scheduler. no faceless avatar. no generic slop. just your voice, on tap.
        </div>

        <div className="reveal" style={{ marginTop: 64 }}>
          <GenerationDemo />
        </div>
      </div>
    </section>
  )
}
