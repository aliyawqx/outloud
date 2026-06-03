import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { ReplyComposer } from '@/components/reply/ReplyComposer'
import { ScrollReveal } from '@/components/ScrollReveal'

export const metadata = { title: 'Outloud | Reply Composer' }

export default function ReplyPage() {
  return (
    <>
      <header className="bg-surface-glass fixed top-0 z-50 w-full border-b border-border-muted backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
          <Link href="/"><Logo /></Link>
          <nav className="hidden items-center gap-gutter md:flex">
            <Link className="font-body-md text-body-md font-bold text-primary" href="/reply">Compose</Link>
            <Link className="font-body-md text-body-md text-on-surface-variant transition-colors hover:text-primary" href="/">Home</Link>
          </nav>
          <Link href="/early-access" className="rounded-full bg-electric-indigo px-6 py-2 font-bold text-white transition-transform active:scale-95">Early Access</Link>
        </div>
      </header>

      <main className="mx-auto max-w-container-max px-margin-mobile pb-16 pt-32 md:px-margin-desktop">
        <ReplyComposer />
      </main>
      <ScrollReveal />
    </>
  )
}
