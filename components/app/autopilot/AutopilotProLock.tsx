import Link from 'next/link'

// Visible-but-locked (plan-gating spec §7): Starter/expired users SEE what
// autopilot is - that sells the upgrade better than hiding the page.
export function AutopilotProLock() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-electric-indigo/40 bg-electric-indigo/5 p-6">
      <span className="flex items-center gap-2 rounded-full border border-electric-indigo/60 px-3 py-1 font-code-label text-code-label uppercase text-electric-indigo">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">lock</span>
        Max feature
      </span>
      <p className="font-body-md text-body-md text-on-surface">
        pick a topic, set a time - outloud writes and publishes for you, even when you&apos;re not here. no login needed.
      </p>
      <ul className="flex flex-col gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
        <li>· auto-fills the empty slots on your calendar</li>
        <li>· fully hands-off posting across X, Threads and LinkedIn</li>
        <li>· live links to every published post, right in your notifications</li>
      </ul>
      <Link
        href="/pricing"
        className="rounded-full bg-electric-indigo px-6 py-2.5 font-code-label text-code-label font-bold text-white transition-all hover:bg-primary-container active:scale-95"
      >
        Upgrade to Max
      </Link>
    </div>
  )
}
