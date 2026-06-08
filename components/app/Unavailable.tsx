import Link from 'next/link'
import { WAITLIST_HREF } from '@/lib/appLock'
import { SignOutButton } from './SignOutButton'

// Shown to users who aren't nFactorial incubator participants.
export function Unavailable() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="glass-panel flex max-w-md flex-col items-center gap-5 rounded-3xl border-cyber-lime/30 p-8">
        <h1 className="font-headline-lg text-headline-lg">Not available yet</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Outloud is currently open to nFactorial incubator participants. Join the waitlist and we’ll
          let you in as we open up.
        </p>
        <Link
          href={WAITLIST_HREF}
          className="rounded-full bg-electric-indigo px-7 py-3 font-bold text-white transition-all hover:bg-primary-container active:scale-95"
        >
          Join the waitlist
        </Link>
      </div>
      <SignOutButton className="fixed bottom-5 left-5" />
    </div>
  )
}
