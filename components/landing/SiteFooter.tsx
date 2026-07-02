import Link from 'next/link'
import { Logo } from '@/components/Logo'

const COLUMNS = [
  { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }] },
  { title: 'Company', links: [{ label: 'Log in', href: '/login' }, { label: 'Get started', href: '/signup' }, { label: 'Contact', href: 'mailto:support@tryoutloud.app' }] },
  { title: 'Legal', links: [{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }] },
]

const SOCIALS = [
  { icon: 'alternate_email', href: 'mailto:support@tryoutloud.app', label: 'Email support' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border-muted bg-charcoal-black">
      <div className="mx-auto max-w-container-max px-margin-mobile py-14 md:px-margin-desktop">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          {/* left: logo + socials */}
          <div>
            <Logo />
            <p className="mt-3 max-w-xs font-body-sm text-body-sm text-on-surface-variant">
              Posts in your own voice. Built for builders shipping in public.
            </p>
            <div className="mt-5 flex gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.icon}
                  href={s.href}
                  aria-label={s.label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-border-muted text-on-surface-variant transition-colors hover:border-electric-indigo hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
                </a>
              ))}
            </div>
          </div>

          {/* right: three link columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="mb-3 font-code-label text-code-label uppercase tracking-wide text-on-surface-variant/60">{col.title}</p>
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

        <div className="mt-12 border-t border-border-muted pt-6">
          <p className="font-body-sm text-body-sm text-on-surface-variant">© 2026 Outloud. Built for builders.</p>
        </div>
      </div>
    </footer>
  )
}
