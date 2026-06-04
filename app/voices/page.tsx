import { redirect } from 'next/navigation'

// The voices page now lives inside the signed-in app shell. Anyone hitting the
// old public URL is sent there (middleware bounces logged-out users to sign-up).
export default function LegacyVoicesPage() {
  redirect('/app/voices')
}
