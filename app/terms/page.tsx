import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'

export const metadata: Metadata = {
  title: 'Outloud | Terms of Service',
  description: 'The terms that govern your use of Outloud.',
}

const CONTACT_EMAIL = 'support@tryoutloud.app'
const LAST_UPDATED = 'June 16, 2026'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 font-headline-sm text-headline-sm text-on-surface">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 font-body-md text-body-md leading-relaxed text-on-surface-variant">{children}</p>
}

export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-2xl px-margin-mobile py-16 md:px-0">
        <h1 className="mb-2 font-headline-xl text-headline-xl text-on-surface">Terms of Service</h1>
        <p className="mb-8 font-code-label text-code-label uppercase text-on-surface-variant/60">Last updated: {LAST_UPDATED}</p>

        <P>
          These terms govern your use of Outloud at <strong>tryoutloud.app</strong> and the Outloud app. By using
          Outloud, you agree to them. If you don’t agree, please don’t use the service.
        </P>

        <H2>The service</H2>
        <P>
          Outloud helps you generate posts and replies in your own voice and publish them to platforms you connect,
          such as X (Twitter) and Threads. Features, limits, and pricing may change over time.
        </P>

        <H2>Your account</H2>
        <P>
          You’re responsible for keeping your login secure and for activity under your account. You must provide
          accurate information and meet the minimum age in your country.
        </P>

        <H2>Connected platforms</H2>
        <P>
          When you connect X or Threads, you authorize Outloud to act on your behalf within the permissions you grant
          (for example, publishing posts and replies, or searching posts on a topic). Your use of those platforms is
          also subject to their own terms and policies. You can disconnect at any time in Profile.
        </P>

        <H2>Your content</H2>
        <P>
          You own the content you create. You’re responsible for what you publish and for ensuring it complies with the
          rules of the platforms you post to and with applicable law. You grant us the permissions needed to operate the
          service (such as processing your inputs to generate drafts and publishing on your request).
        </P>

        <H2>Acceptable use</H2>
        <P>
          Don’t use Outloud to break the law, infringe others’ rights, spam, or violate the policies of connected
          platforms. We may suspend or terminate accounts that do.
        </P>

        <H2>Payments</H2>
        <P>
          Paid plans are billed through our payment provider. Unless stated otherwise, fees are non-refundable and
          subscriptions renew until cancelled.
        </P>

        <H2>Disclaimers & liability</H2>
        <P>
          The service is provided “as is” without warranties. Generated content may contain errors — review it before
          publishing. To the extent permitted by law, we are not liable for indirect or consequential damages.
        </P>

        <H2>Changes & termination</H2>
        <P>
          We may update these terms or the service, and you may stop using Outloud at any time. We’ll revise the “Last
          updated” date for material changes.
        </P>

        <H2>Contact</H2>
        <P>
          Questions? Email <a className="text-electric-indigo hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </P>

        <p className="mt-10">
          <Link href="/" className="font-code-label text-code-label text-electric-indigo hover:underline">← Back to home</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
