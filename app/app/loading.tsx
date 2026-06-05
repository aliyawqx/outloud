// Instant streamed fallback shown while a /app/* page's server component loads
// (profile/voices/history queries). The sidebar stays put (it's in the layout);
// only the main area swaps to this skeleton, so navigation never feels frozen.
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse" aria-hidden="true">
      <div className="h-9 w-2/3 rounded-lg bg-surface-container-high" />
      <div className="mt-3 h-4 w-1/2 rounded bg-surface-container-low" />
      <div className="mt-8 h-40 w-full rounded-2xl bg-surface-container-low" />
      <div className="mt-4 flex gap-3">
        <div className="h-9 w-28 rounded-full bg-surface-container-low" />
        <div className="h-9 w-28 rounded-full bg-surface-container-low" />
      </div>
    </div>
  )
}
