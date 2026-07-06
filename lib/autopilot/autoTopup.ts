// Auto-topup seam (zero-touch addendum A.4). Polar can't charge off-session
// today (one-time checkouts require the user present), so this is a documented
// no-op hook: when saved-payment charging lands, wire it HERE and the
// generation cron's credit gate picks it up with no other changes.
export async function maybeAutoTopup(_userId: string): Promise<boolean> {
  return false
}
