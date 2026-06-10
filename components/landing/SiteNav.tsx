import Link from 'next/link'
import { Logo } from '@/components/Logo'

const NAV = [
  { label: 'Home', href: '#top' },
  { label: 'Features', href: '#features' },
  { label: 'Examples', href: '#examples' },
  { label: 'Pricing', href: '#pricing' },
]

const link =
  'relative font-body-md text-body-md text-on-surface-variant transition-colors hover:text-on-surface ' +
  'after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 ' +
  'after:bg-electric-indigo after:transition-transform after:duration-300 hover:after:scale-x-100 motion-reduce:after:transition-none'

export function SiteNav() {
  return (
    <div className="sticky top-0 z-50">
      <header className="w-full border-b border-border-muted bg-surface-glass backdrop-blur-md">
        <nav className="mx-auto flex h-20 w-full max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
          <Link href="#top">
            <Logo />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className={link}>
                {n.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className={`hidden sm:inline ${link}`}>
              Log in
            </Link>
            <Link
              href="/signup"
              className="indigo-glow rounded-full bg-electric-indigo px-6 py-2 font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>
    </div>
  )
}
