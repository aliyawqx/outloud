import { isStaff } from '@/lib/appLock'

// Threads OAuth only works for accounts with a role on the Meta app: its
// permissions sit at Standard Access until Meta's App Review + business
// verification go through. Until then, ONLY invited testers can connect -
// everyone else gets a disabled button with a contact note instead of a
// guaranteed-to-fail OAuth redirect.
const THREADS_TESTER_EMAILS = new Set(['yerikaisha2@gmail.com', 'yerkinzhanabayev@gmail.com'])

export function canConnectThreads(email: string): boolean {
  return isStaff(email) || THREADS_TESTER_EMAILS.has(email.toLowerCase())
}
