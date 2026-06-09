// Shown while a /app/* page's server component loads on navigation (profile/
// voices/history queries, which can take a moment). The sidebar stays put (it's
// in the layout); only the main area swaps to this centered spinner, so the user
// can see it's working, not frozen.
export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 text-on-surface-variant"
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined animate-spin text-[40px] text-electric-indigo motion-reduce:animate-none"
      >
        progress_activity
      </span>
      <span className="font-code-label text-code-label">Loading…</span>
    </div>
  )
}
