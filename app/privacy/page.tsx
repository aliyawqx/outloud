import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/landing/SiteNav'
import { SiteFooter } from '@/components/landing/SiteFooter'

export const metadata: Metadata = {
  title: 'Outloud | Privacy Policy',
  description: 'How Outloud collects, uses, stores, and protects your data.',
}

// Contact for privacy questions and data-deletion requests. Make sure this inbox
// is actually monitored (or change it to one that is) - Meta and users may use it.
const CONTACT_EMAIL = 'support@tryoutloud.app'
const LAST_UPDATED = 'June 16, 2026'

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 mb-3 font-headline-sm text-headline-sm text-on-surface">
      {children}
    </h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 font-body-md text-body-md leading-relaxed text-on-surface-variant">{children}</p>
}

function LI({ children }: { children: React.ReactNode }) {
  return <li className="font-body-md text-body-md leading-relaxed text-on-surface-variant">{children}</li>
}

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-2xl px-margin-mobile py-16 md:px-0">
        <h1 className="mb-2 font-headline-xl text-headline-xl text-on-surface">Privacy Policy</h1>
        <p className="mb-8 font-code-label text-code-label uppercase text-on-surface-variant/60">Last updated: {LAST_UPDATED}</p>

        <P>
          Outloud (“we”, “us”) helps you generate and publish posts and replies in your own voice to social platforms
          you connect, such as X (Twitter) and Threads. This policy explains what we collect, how we use it, who we
          share it with, and the choices you have. It applies to <strong>tryoutloud.app</strong> and the Outloud app.
        </P>

        <H2>Information we collect</H2>
        <ul className="mb-3 list-disc space-y-2 pl-5">
          <LI><strong>Account data:</strong> your email address and a securely hashed password used to sign in, plus email verification codes.</LI>
          <LI><strong>Voice & content data:</strong> the writing samples you provide, voice profiles, the ideas you enter, and the drafts, replies, and chat transcripts generated in the app.</LI>
          <LI><strong>Connected accounts:</strong> when you connect X or Threads, we store the access (and, for X, refresh) tokens and your account handle/ID. Tokens are encrypted at rest and used only to act on your behalf.</LI>
          <LI><strong>Usage & billing:</strong> credit usage, plan, and subscription status. Payments are processed by our payment provider; we do not store your card details.</LI>
          <LI><strong>Technical data:</strong> basic logs and aggregate analytics needed to run and improve the service.</LI>
        </ul>

        <H2>How we use your information</H2>
        <ul className="mb-3 list-disc space-y-2 pl-5">
          <LI>To capture your writing voice and generate posts, replies, and topic suggestions.</LI>
          <LI>To publish content and replies to the platforms you connect, when you ask us to.</LI>
          <LI>To search for posts on a topic on a connected platform, when you use topic discovery.</LI>
          <LI>To authenticate you, run billing, provide support, and keep the service secure.</LI>
        </ul>

        <H2>Service providers we share data with</H2>
        <P>
          We share the minimum data needed with providers that operate the service. We do not sell your personal data.
        </P>
        <ul className="mb-3 list-disc space-y-2 pl-5">
          <LI><strong>Anthropic (Claude):</strong> your voice samples and prompts are sent to generate and evaluate content.</LI>
          <LI><strong>X (Twitter) API:</strong> to read posts and publish posts/replies, and topic search, using your connected account.</LI>
          <LI><strong>Meta / Threads API:</strong> to publish posts/replies and run topic search using your connected Threads account.</LI>
          <LI><strong>Payments provider:</strong> to process checkout and subscriptions.</LI>
          <LI><strong>Email providers:</strong> to send verification codes and notifications.</LI>
          <LI><strong>Hosting & database:</strong> to host the app and store your data, and basic product analytics.</LI>
        </ul>

        <H2>Data from connected platforms</H2>
        <P>
          Your use of connected platforms is also governed by their own terms and policies. We access only what the
          permissions you grant allow - for example, publishing on your behalf, reading a post you choose to reply to,
          or searching public posts on a topic. You can revoke access at any time from your platform’s app settings, or
          by disconnecting the account in Outloud.
        </P>

        <H2>Retention</H2>
        <P>
          We keep your data while your account is active. When you disconnect a platform, the stored tokens for that
          platform are deleted. When you delete your account, we delete your associated personal data, except where we
          must retain limited records to meet legal or billing obligations.
        </P>

        <H2 id="data-deletion">Your rights & deleting your data</H2>
        <P>
          You can access, correct, or delete your data at any time:
        </P>
        <ul className="mb-3 list-disc space-y-2 pl-5">
          <LI><strong>Disconnect a platform:</strong> in <em>Profile</em>, use Disconnect next to X or Threads to remove its stored tokens.</LI>
          <LI><strong>Delete your account:</strong> in <em>Profile</em>, use Delete account to erase your profile, voices, drafts, and connected-account data.</LI>
          <LI><strong>Request deletion by email:</strong> contact us at <a className="text-electric-indigo hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will delete your data.</LI>
        </ul>

        <H2>Security</H2>
        <P>
          Connected-account tokens are encrypted at rest, passwords are hashed, and access is restricted to operating
          the service. No method of storage or transmission is completely secure, but we take reasonable measures to
          protect your data.
        </P>

        <H2>Children</H2>
        <P>Outloud is not directed to children under 13 (or the minimum age in your country), and we do not knowingly collect their data.</P>

        <H2>Changes</H2>
        <P>We may update this policy. We will revise the “Last updated” date above, and significant changes will be communicated where appropriate.</P>

        <H2>Contact</H2>
        <P>
          Questions or requests? Email <a className="text-electric-indigo hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </P>

        <p className="mt-10">
          <Link href="/" className="font-code-label text-code-label text-electric-indigo hover:underline">← Back to home</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
