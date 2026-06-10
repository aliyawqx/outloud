// Client helper: start a Polar checkout for a paid plan and redirect to it.
// Logged-out users are sent to sign up first (checkout needs a user to attach to).
export async function startCheckout(plan: 'pro' | 'starter'): Promise<void> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  if (res.status === 401) {
    window.location.href = '/signup'
    return
  }
  const data = await res.json().catch(() => ({}))
  if (data.url) {
    window.location.href = data.url
    return
  }
  throw new Error(data.error || "Couldn't start checkout.")
}
