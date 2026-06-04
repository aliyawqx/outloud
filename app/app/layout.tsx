import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getProfile } from '@/lib/profile/store'
import { listProfiles } from '@/lib/voice/store'
import { AppSidebar } from '@/components/app/AppSidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/signup')

  const [profile, voices] = await Promise.all([
    getProfile(session.userId),
    listProfiles(session.userId),
  ])

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
      <main className="min-w-0 flex-1 px-margin-mobile py-8 md:px-10 lg:px-12">{children}</main>
    </div>
  )
}
