import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { CountdownBar } from '@/components/CountdownBar'
import { Pricing } from '@/components/Pricing'
import { ScrollReveal } from '@/components/ScrollReveal'

export const metadata = { title: 'Outloud | Pricing' }

export default function PricingPage() {
  return (
    <>
      <CountdownBar sticky />

      <header className="border-b border-border-muted">
        <div className="mx-auto flex h-20 w-full max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="flex items-center gap-6">
            <Link className="font-body-md text-body-md text-on-surface-variant transition-colors hover:text-primary" href="/">
              Home
            </Link>
            <Link
              className="rounded-full bg-electric-indigo px-6 py-2 font-bold text-white transition-transform active:scale-95"
              href="/early-access"
            >
              Early Access
            </Link>
          </nav>
        </div>
      </header>

      <main className="pb-24 pt-8">
        <Pricing />
      </main>

      <footer className="border-t border-border-muted bg-charcoal-black py-10">
        <div className="mx-auto flex max-w-container-max flex-col items-center justify-between gap-4 px-margin-mobile md:flex-row md:px-margin-desktop">
          <Logo wordClass="text-body-md" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">© 2026 Outloud. Built for builders.</p>
        </div>
      </footer>
      <ScrollReveal />
    </>
  )
}
