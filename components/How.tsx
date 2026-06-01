'use client'

import { useReveal } from './hooks'
import { VoiceCapture } from './VoiceCapture'
import { Analytics } from './Analytics'

export function How() {
  const ref = useReveal<HTMLElement>()
  return (
    <section id="how" className="section" ref={ref}>
      <div className="wrap">
        <div className="reveal" style={{ marginBottom: 64, maxWidth: '20ch' }}>
          <div className="kicker" style={{ marginBottom: 20 }}>
            how it works
          </div>
          <h2 className="h-sec">Three moves. Thirty seconds a post.</h2>
        </div>
        <VoiceCapture />
        <hr className="hairline" style={{ margin: '72px 0' }} />
        <Analytics />
      </div>
    </section>
  )
}
