import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { ScrollReveal } from '@/components/ScrollReveal'
import { CountdownBar } from '@/components/CountdownBar'
import { Pricing } from '@/components/Pricing'

export default function Page() {
  return (
    <>
      <header className="bg-surface-glass fixed top-0 z-50 w-full border-b border-border-muted backdrop-blur-md">
        <nav className="mx-auto flex h-20 w-full max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
          <Logo />
          <div className="hidden items-center gap-8 font-body-md text-body-md md:flex">
            <a className="font-bold text-primary" href="#">Home</a>
            <a className="text-on-surface-variant transition-colors hover:text-primary" href="#features">Features</a>
            <a className="text-on-surface-variant transition-colors hover:text-primary" href="#social-proof">Examples</a>
            <a className="text-on-surface-variant transition-colors hover:text-primary" href="#pricing">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link className="font-body-md text-body-md text-on-surface-variant transition-colors hover:text-primary" href="/early-access">Login</Link>
            <Link className="indigo-glow rounded-full bg-electric-indigo px-6 py-2 font-bold text-white transition-transform hover:scale-95" href="/early-access">Early Access</Link>
          </div>
        </nav>
      </header>

      <main className="pt-32 pb-24">
        {/* Hero */}
        <section className="mx-auto mb-32 max-w-container-max px-margin-mobile text-center md:px-margin-desktop">
          <div className="reveal mb-8 inline-flex items-center gap-2 rounded-full border border-border-muted bg-surface-container-low px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric-indigo opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-electric-indigo" />
            </span>
            <span className="font-code-label text-code-label uppercase tracking-widest text-on-surface-variant">Only 10 builder spots left</span>
          </div>
          <h1 className="reveal mb-6 font-headline-xl text-headline-xl leading-tight" style={{ transitionDelay: '80ms' }}>
            Turn what you ship into
            <br />
            <span className="bg-gradient-to-r from-electric-indigo to-secondary bg-clip-text text-transparent">X posts in your own voice.</span>
          </h1>
          <p className="reveal mx-auto mb-10 max-w-2xl font-body-md text-body-md text-on-surface-variant" style={{ transitionDelay: '160ms' }}>
            Stop the generic AI slop. Outloud captures your technical nuance and personality, transforming code updates and build-in-public logs into high-signal engagement.
          </p>
          <div className="reveal flex flex-col justify-center gap-4 md:flex-row" style={{ transitionDelay: '240ms' }}>
            <Link href="/early-access" className="indigo-glow rounded-full bg-electric-indigo px-8 py-4 text-lg font-bold text-white transition-all active:scale-95">Join Early Access</Link>
            <a href="#features" className="rounded-full border border-border-muted px-8 py-4 text-lg font-bold text-on-surface transition-all hover:border-white">See Features</a>
          </div>

          {/* Terminal mock */}
          <div className="reveal relative mt-20" style={{ transitionDelay: '320ms' }}>
            <div className="absolute -top-20 left-1/2 -z-10 h-96 w-full max-w-4xl -translate-x-1/2 animate-[drift_9s_ease-in-out_infinite] rounded-full bg-electric-indigo/10 blur-[120px]" />
            <div className="glass-card mx-auto max-w-4xl overflow-hidden rounded-xl p-4 text-left shadow-2xl md:p-6">
              <div className="mb-4 flex items-center gap-2 border-b border-border-muted pb-4">
                <div className="h-3 w-3 rounded-full bg-error/40" />
                <div className="h-3 w-3 rounded-full bg-secondary/40" />
                <div className="h-3 w-3 rounded-full bg-electric-indigo/40" />
                <span className="ml-4 font-code-label text-code-label text-on-surface-variant">~/outloud/composer --mode ship-in-public</span>
              </div>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="font-code-label text-code-label text-electric-indigo">INPUT_SOURCE: GIT_COMMIT</span>
                    <div className="terminal-text rounded border border-border-muted bg-charcoal-black p-4 text-sm">feat: integrated glassmorphic layers into the core UI system. fixed 8px rhythm issues in mobile view. performance +12%.</div>
                  </div>
                  <div className="space-y-2">
                    <span className="font-code-label text-code-label text-cyber-lime">VOICE_PROFILE: ELON_PUNK</span>
                    <div className="flex gap-2">
                      {['BLUNT', 'SHORT', 'HARDCORE'].map((t) => (
                        <span key={t} className="rounded border border-secondary/20 bg-secondary/10 px-2 py-1 text-[10px] text-secondary">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <span className="font-code-label text-code-label text-on-surface-variant">GENERATED_DRAFT</span>
                  <div className="group relative overflow-hidden rounded-lg border border-primary/20 bg-surface-container-highest p-6">
                    <p className="mb-4 font-body-md italic text-on-surface">
                      &quot;Just finished shipping the glassmorphic core. Finally, an 8px vertical rhythm that doesn&apos;t feel like a broken drum machine. +12% speed because physics matters. ⚡️&quot;
                    </p>
                    <div className="flex items-center justify-between font-code-label text-[11px] text-on-surface-variant">
                      <span>POST_TO_X_READY</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 animate-pulse rounded-full bg-cyber-lime" /> SYSTEM_LIVE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto mb-32 max-w-container-max px-margin-mobile md:px-margin-desktop">
          <div className="reveal mb-16 flex flex-col items-end justify-between gap-8 md:flex-row">
            <div className="max-w-xl">
              <h2 className="mb-4 font-headline-lg text-headline-lg">Precision tools for digital builders.</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">We built the engine we wanted for our own &quot;build-in-public&quot; journey. No hallucinations, just your intent, polished for X.</p>
            </div>
            <div className="border-b border-cyber-lime/30 pb-2 font-code-label text-code-label text-cyber-lime">0x01 // CORE_MODULES</div>
          </div>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
            <div className="reveal glass-card group rounded-3xl p-8 transition-colors hover:border-electric-indigo/50 md:col-span-8">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric-indigo/20">
                  <span className="material-symbols-outlined text-electric-indigo">auto_awesome</span>
                </div>
                <span className="font-code-label text-code-label text-on-surface-variant opacity-50">FEATURE_01</span>
              </div>
              <h3 className="mb-3 font-headline-lg text-headline-lg">AI Post Composer</h3>
              <p className="mb-8 max-w-lg font-body-sm text-body-sm text-on-surface-variant">
                Your rough idea, turned into a full post that sounds like you. Drop a line about what you shipped, pick a voice, and get a ready hook, story and offer, no blank page.
              </p>

              <div className="glass-panel flex flex-col items-stretch gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
                <div className="flex-1 rounded-xl border border-border-muted bg-white/[0.04] p-3 font-code-label text-[12px] text-on-surface-variant backdrop-blur-sm">
                  &ldquo;shipped dark mode&rdquo;
                </div>
                <span className="material-symbols-outlined mx-auto animate-pulse text-cyber-lime sm:mx-0">arrow_forward</span>
                <div className="flex-[1.4] rounded-xl border border-electric-indigo/30 bg-white/[0.05] p-3 backdrop-blur-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-electric-indigo/40" />
                    <span className="h-2 w-24 rounded-full bg-on-surface/20" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block h-2 w-full rounded-full bg-on-surface/15" />
                    <span className="block h-2 w-4/5 rounded-full bg-on-surface/15" />
                    <span className="block h-2 w-2/3 rounded-full bg-on-surface/10" />
                  </div>
                </div>
              </div>
            </div>

            <div className="reveal glass-card group rounded-3xl p-8 transition-colors hover:border-cyber-lime/50 md:col-span-4" style={{ transitionDelay: '100ms' }}>
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/20">
                  <span className="material-symbols-outlined text-secondary">mic</span>
                </div>
                <span className="font-code-label text-code-label text-on-surface-variant opacity-50">FEATURE_02</span>
              </div>
              <h3 className="mb-3 font-headline-lg text-headline-lg">Voice Capture</h3>
              <p className="mb-6 font-body-sm text-body-sm text-on-surface-variant">elon, naval, or just you. it learns the cadence from a few posts and keeps every draft on-voice.</p>

              <div className="mb-5 flex flex-wrap gap-2">
                {['Elon', 'Naval', 'You'].map((v, i) => (
                  <span
                    key={v}
                    className={`rounded-full border px-3 py-1 font-code-label text-[11px] ${
                      i === 2 ? 'border-secondary bg-secondary/10 text-secondary' : 'border-border-muted text-on-surface-variant'
                    }`}
                  >
                    {v}
                  </span>
                ))}
              </div>
              <div className="glass-panel flex h-20 items-center justify-center gap-1.5 rounded-2xl">
                {[8, 16, 26, 36, 22, 30, 12, 20, 28, 10].map((h, i) => (
                  <span key={i} className="w-1 animate-bounce rounded-full bg-secondary" style={{ height: h, animationDelay: `${i * 90}ms` }} />
                ))}
              </div>
            </div>

            <div className="reveal glass-card group flex flex-col items-center gap-12 rounded-3xl p-8 transition-colors hover:border-white/20 md:col-span-12 md:flex-row" style={{ transitionDelay: '150ms' }}>
              <div className="md:flex-1">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyber-lime/20">
                    <span className="material-symbols-outlined text-cyber-lime">rocket_launch</span>
                  </div>
                  <span className="font-code-label text-code-label text-on-surface-variant opacity-50">FEATURE_03</span>
                </div>
                <h3 className="mb-3 font-headline-lg text-headline-lg">Build-in-public Copilot</h3>
                <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">a commit, a changelog, a half-thought. it finds the win, writes the hook, and lines up the post so you just ship and post.</p>
              </div>
              <div className="glass-panel w-full rounded-2xl p-4 md:w-1/3">
                <ul className="space-y-4 font-code-label text-[12px]">
                  <li className="flex items-center justify-between text-secondary"><span>&gt; ANALYZING_INPUT</span><span className="material-symbols-outlined text-sm">check_circle</span></li>
                  <li className="flex items-center justify-between text-on-surface-variant"><span>&gt; VOICE_MATCHED</span><span className="material-symbols-outlined text-sm">link</span></li>
                  <li className="flex items-center justify-between text-on-surface-variant"><span>&gt; HOOK: &quot;I finally killed our design debt...&quot;</span><span className="material-symbols-outlined text-sm">history_edu</span></li>
                  <li className="border-t border-border-muted pt-4">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-electric-indigo/20"><div className="h-full w-[85%] bg-electric-indigo" /></div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section id="social-proof" className="bg-surface-container-lowest py-24">
          <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
            <div className="reveal mb-16 text-center">
              <h2 className="mb-4 font-headline-lg text-headline-lg">Results that don&apos;t look like ChatGPT.</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">See how Outloud users out-wit the timeline.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                { name: 'Alex (Builder)', handle: '@shipit_alex', dot: 'bg-primary-fixed-dim', ctx: 'Idea in: "shipped dark mode, broke prod once"', border: 'border-electric-indigo', text: '"shipped dark mode today, broke prod once right in the middle, classic. works now, mostly. small thing but it bugged me every time i opened the app."', likes: 124, rt: 12 },
                { name: 'Sarah (SaaS Founder)', handle: '@founder_sarah', dot: 'bg-secondary-fixed-dim', ctx: 'Post: "Why your SaaS marketing strategy is wrong."', border: 'border-cyber-lime', text: '"Most founders do SEO. It\'s boring. I tell stories. Outloud turned my boring updates into contrarian hooks that actually move the needle."', likes: 892, rt: 45 },
                { name: 'Devon (Indie Hacker)', handle: '@devon_builds', dot: 'bg-tertiary-fixed-dim', ctx: 'Post: "shipping 2 new features today"', border: 'border-on-surface-variant', text: '"just shipped 2 new features. no sleep but 100% worth it. 0 ads, just pure vibing with the users."', likes: 341, rt: 28 },
              ].map((c, i) => (
                <div key={c.handle} className="reveal rounded-xl border border-border-muted bg-charcoal-black p-6" style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full ${c.dot}`} />
                    <div>
                      <p className="font-body-sm font-bold">{c.name}</p>
                      <p className="text-[12px] text-on-surface-variant">{c.handle}</p>
                    </div>
                  </div>
                  <p className="mb-4 font-body-md text-on-surface">{c.ctx}</p>
                  <div className={`rounded-lg border-l-4 ${c.border} bg-surface-container p-4 font-body-sm italic`}>{c.text}</div>
                  <div className="mt-4 flex items-center gap-4 text-on-surface-variant">
                    <span className="flex items-center gap-1 text-[12px]"><span className="material-symbols-outlined text-[16px]">favorite</span> {c.likes}</span>
                    <span className="flex items-center gap-1 text-[12px]"><span className="material-symbols-outlined text-[16px]">repeat</span> {c.rt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <div className="mb-4 mt-8">
          <CountdownBar />
        </div>
        <Pricing condensed />

        {/* Final CTA */}
        <section className="mx-auto max-w-container-max px-margin-mobile py-32 text-center md:px-margin-desktop">
          <div className="reveal glass-card relative overflow-hidden rounded-2xl p-12">
            <div className="absolute -bottom-20 -right-20 h-80 w-80 animate-[drift_11s_ease-in-out_infinite] rounded-full bg-secondary/10 blur-[80px]" />
            <div className="relative z-10">
              <h2 className="mb-6 font-headline-xl text-headline-xl">Build in public.<br />Post without friction.</h2>
              <p className="mx-auto mb-10 max-w-xl font-body-md text-body-md text-on-surface-variant">Ready to stop the generic AI slop? Join early access and start shipping posts as fast as you ship code.</p>
              <div className="flex flex-col items-center">
                <Link href="/early-access" className="indigo-glow mb-6 rounded-full bg-electric-indigo px-10 py-5 text-xl font-bold text-white transition-all active:scale-95">Join Early Access</Link>
                <p className="font-code-label text-code-label uppercase tracking-widest text-on-surface-variant">Limited spots available</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-border-muted bg-charcoal-black py-12">
        <div className="mx-auto flex max-w-container-max flex-col items-center justify-between gap-8 px-margin-mobile md:flex-row md:px-margin-desktop">
          <Logo wordClass="text-body-md" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">© 2026 Outloud. Built for builders.</p>
          <div className="flex flex-wrap justify-center gap-8 font-body-sm text-body-sm text-on-surface-variant">
            <a className="transition-colors hover:text-secondary" href="#">X (Twitter)</a>
            <a className="transition-colors hover:text-secondary" href="#">Privacy</a>
            <a className="transition-colors hover:text-secondary" href="#">Terms</a>
          </div>
        </div>
      </footer>
      <ScrollReveal />
    </>
  )
}
