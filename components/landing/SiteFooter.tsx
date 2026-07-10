import Link from 'next/link'
import { Logo } from '@/components/Logo'

const COLUMNS = [
  // Root-anchored so they work from ANY page the footer appears on (e.g. /pricing).
  { title: 'Product', links: [{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/pricing' }, { label: 'FAQ', href: '/#faq' }] },
  { title: 'Company', links: [{ label: 'Log in', href: '/login' }, { label: 'Get started', href: '/signup' }, { label: 'Contact', href: 'mailto:support@tryoutloud.app' }] },
  { title: 'Legal', links: [{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }] },
]

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border-muted bg-charcoal-black">
      {/* branded hairline + soft depth glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-indigo/50 to-transparent" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[36rem] -translate-x-1/2 rounded-full bg-electric-indigo/10 blur-[100px]" />

      <div className="relative mx-auto max-w-container-max px-margin-mobile py-16 md:px-margin-desktop">
        <div className="flex flex-col justify-between gap-12 md:flex-row">
          {/* left: brand + final nudge */}
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              Posts that sound like you. Never smellable as AI.
            </p>
            <Link
              href="/signup"
              className="group mt-5 inline-flex items-center gap-1.5 font-code-label text-code-label text-electric-indigo transition-colors hover:text-on-surface"
            >
              Start free
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
            </Link>
          </div>

          {/* right: three link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-14">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="mb-3.5 font-code-label text-code-label uppercase tracking-wide text-on-surface-variant/60">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-on-surface">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border-muted pt-6 sm:flex-row sm:items-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant/70">© 2026 Outloud. Built for builders.</p>
          <a href="mailto:support@tryoutloud.app" className="font-body-sm text-body-sm text-on-surface-variant/70 transition-colors hover:text-on-surface">
            support@tryoutloud.app
          </a>
        </div>
      </div>
    </footer>
  )
}
