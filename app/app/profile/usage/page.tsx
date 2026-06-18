import { redirect } from 'next/navigation'

// Usage now lives on the Billing & usage page (Usage tab).
export default function UsageRedirect() {
  redirect('/app/settings/billing')
}
