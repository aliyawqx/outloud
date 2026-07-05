import Link from 'next/link'

// Amber "reconnect LinkedIn" strip (spec §5) shown on the calendar and
// autopilot pages when the connection is dead or (no refresh token) expiring.
export function LinkedInReconnectBanner({ expiring = false }: { expiring?: boolean }) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-error/40 bg-error/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-body-sm text-body-sm text-on-surface">
        {expiring
          ? 'your linkedin connection expires soon — reconnect to avoid a posting gap.'
          : 'your linkedin connection expired — scheduled linkedin posts will fail until you reconnect.'}
      </p>
      <Link
        href="/app/profile"
        className="shrink-0 rounded-full bg-electric-indigo px-4 py-2 text-center font-code-label text-code-label font-bold text-white transition-colors hover:bg-primary-container"
      >
        Reconnect LinkedIn
      </Link>
    </div>
  )
}
