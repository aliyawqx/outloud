import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { AppSidebar } from '@/components/app/AppSidebar'
import { ComingSoonGate } from '@/components/app/ComingSoonGate'
import { isAppUnlockedFor } from '@/lib/appLock'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/signup')

  const [profile, voices] = await Promise.all([
    getProfile(session.userId),
    listProfiles(session.userId),
  ])

  const locked = !isAppUnlockedFor(session.email)

  return (
    <div className="min-h-screen lg:flex">
      <AppSidebar
        profile={{
          displayName: profile?.displayName || session.email,
          avatarUrl: profile?.avatarUrl ?? null,
          plan: profile?.plan ?? 'free',
        }}
        voiceCount={voices.length}
      />
      <main className="relative min-w-0 flex-1 px-margin-mobile py-8 md:px-10 lg:px-12">
        {locked ? (
          <>
            <div className="pointer-events-none select-none opacity-40 blur-[6px]" aria-hidden="true">
              {children}
            </div>
            <ComingSoonGate />
          </>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
