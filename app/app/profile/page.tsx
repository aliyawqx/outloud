import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { ProfileForm } from '@/components/app/ProfileForm'
import { XConnection } from '@/components/app/XConnection'
import { ThreadsConnection } from '@/components/app/ThreadsConnection'
import { AddCredits } from '@/components/app/AddCredits'
import { DeleteAccount } from '@/components/app/DeleteAccount'

export const metadata = { title: 'Outloud | Profile' }

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ x?: string; threads?: string; topup?: string }> }) {
  const session = await getSession()
  if (!session) return null
  const profile = await getProfile(session.userId)
  const { x, threads, topup } = await searchParams
  const flash = x === 'connected' || x === 'error' ? x : undefined
  const threadsFlash = threads === 'connected' || threads === 'error' ? threads : undefined

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 font-headline-xl text-headline-xl">Your profile</h1>
      <p className="mb-8 font-body-md text-body-md text-on-surface-variant">{session.email}</p>
      <ProfileForm
        initial={{
          displayName: profile?.displayName ?? '',
          handle: profile?.handle ?? '',
          avatarUrl: profile?.avatarUrl ?? '',
          plan: profile?.plan ?? 'free',
        }}
      />
      {/* Credits: balance lives in the header; here we top up + link to usage. */}
      <div className="mt-8 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-code-label text-code-label uppercase text-on-surface-variant">Credits</span>
          <Link href="/app/profile/usage" className="font-code-label text-code-label text-electric-indigo hover:underline">
            View usage →
          </Link>
        </div>
        {topup === 'success' && (
          <p className="font-body-sm text-body-sm text-cyber-lime">Payment received — your credits will appear in a moment.</p>
        )}
        <AddCredits trialing={Boolean(profile?.trialing)} />
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <XConnection flash={flash} />
        <ThreadsConnection flash={threadsFlash} />
      </div>
      <DeleteAccount />
    </div>
  )
}
