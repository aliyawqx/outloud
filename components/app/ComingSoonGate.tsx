import Link from 'next/link'
import { WAITLIST_HREF } from '@/lib/appLock'

// Centered lock overlay shown over the (blurred) app content until launch.
export function ComingSoonGate() {
  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]">
      <div className="glass-panel flex max-w-md flex-col items-center gap-5 rounded-3xl border-cyber-lime/30 p-8 text-center shadow-[0_0_60px_-15px] shadow-electric-indigo/40">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-electric-indigo/15 text-electric-indigo">
          <span aria-hidden="true" className="material-symbols-outlined text-[32px]">lock</span>
        </span>
        <div>
          <h2 className="font-headline-lg text-headline-lg">Opening soon</h2>
          <p className="mx-auto mt-2 max-w-sm font-body-md text-body-md text-on-surface-variant">
            We’re putting the finishing touches on Outloud. Join the waitlist and we’ll let you in first.
          </p>
        </div>
        <Link
          href={WAITLIST_HREF}
          className="rounded-full bg-electric-indigo px-7 py-3 font-bold text-white transition-all hover:bg-primary-container active:scale-95"
        >
          Join the waitlist
        </Link>
      </div>
    </div>
  )
}
