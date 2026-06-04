import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { VoiceStudio } from '@/components/voice/VoiceStudio'
import { ScrollReveal } from '@/components/ScrollReveal'

export const metadata = { title: 'Outloud | Voice Library' }

export default function VoicesPage() {
  return (
    <>
      <header className="bg-surface-glass fixed top-0 z-50 w-full border-b border-border-muted backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-gutter md:flex">
            <Link className="font-body-md text-body-md font-bold text-primary" href="/voices">
              Voices
            </Link>
            <Link className="font-body-md text-body-md text-on-surface-variant transition-colors hover:text-primary" href="/">
              Home
            </Link>
          </nav>
          <Link
            href="/early-access"
            className="rounded-full bg-electric-indigo px-6 py-2 font-bold text-white transition-transform active:scale-95"
          >
            Early Access
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-container-max px-margin-mobile pb-16 pt-32 md:px-margin-desktop">
        <div className="reveal mb-10">
          <div className="mb-3 font-code-label text-code-label uppercase tracking-widest text-cyber-lime">
            0x03 // VOICE INSPIRATION
          </div>
          <h1 className="mb-3 font-headline-xl text-headline-xl">Build your voice.</h1>
          <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
            No captured voice yet? Pick the creators whose style you admire and we blend them into one hybrid voice
            that’s yours. Inspiration only — your posts stay about your ideas, in your blended style.
          </p>
        </div>

        <VoiceStudio />
      </main>
      <ScrollReveal />
    </>
  )
}
