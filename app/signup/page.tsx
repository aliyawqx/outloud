import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { AuthForm } from '@/components/auth/AuthForm'
import { getSession } from '@/lib/auth/session'

export const metadata = { title: 'Outloud | Sign up' }

export default async function SignupPage() {
  if (await getSession()) redirect('/app')
  return (
    <main className="flex min-h-screen items-center justify-center px-margin-mobile py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-block">
          <Logo />
        </Link>
        <div className="glass-card rounded-3xl p-8">
          <h1 className="font-headline-lg text-headline-lg">Start posting in your voice.</h1>
          <p className="mt-2 mb-6 font-body-md text-body-md text-on-surface-variant">
            Create your account, then pick the creators you want to write like.
          </p>
          <Suspense>
            <AuthForm mode="signup" />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
