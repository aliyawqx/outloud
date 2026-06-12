import { redirect } from 'next/navigation'

// The public waitlist was removed — anyone landing here goes straight to sign up.
// Kept as a redirect so old links, the footer, and shared URLs still resolve.
export default function EarlyAccessPage() {
  redirect('/signup')
}
