import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { resetIfDue } from '@/lib/credits'
import { BillingUsage } from '@/components/app/BillingUsage'

export const metadata = { title: 'Outloud | Billing & usage' }

export default async function BillingPage() {
  const session = await getSession()
  if (!session) return null
  await resetIfDue(session.userId) // keep the free cycle fresh before reading usage
  const profile = await getProfile(session.userId)
  return (
    <BillingUsage
      plan={profile?.plan ?? 'free'}
      trialing={Boolean(profile?.trialing)}
      hasBilling={Boolean(profile?.polarCustomerId)}
    />
  )
}
