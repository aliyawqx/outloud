import { Resend } from 'resend'

// Sends the email-verification code to a new user. Modeled on lib/notify.ts:
// non-fatal by design — if Resend isn't configured or the send fails, we log and
// return, so signup never breaks. The caller treats this as best-effort.
//
// NOTE: the Resend test sender (onboarding@resend.dev) only delivers to the
// account owner's verified address. Until a domain is verified, real users won't
// receive the email — so in non-production we also log the code to the server so
// the flow stays testable and the operator can read it.

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[verify] code for ${email}: ${code}`)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[verify] RESEND_API_KEY not set — skipping verification email')
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.VERIFY_EMAIL_FROM || 'Outloud <onboarding@resend.dev>'

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject: `Your Outloud verification code: ${code}`,
      text: `Welcome to Outloud.\n\nYour verification code is ${code}.\n\nEnter it to finish setting up your account. It expires in 15 minutes.\n\nIf you didn't sign up, you can ignore this email.`,
    })
    if (error) {
      console.error('[verify] Resend returned an error:', error)
    } else {
      console.log('[verify] code email sent to', email, 'id:', data?.id)
    }
  } catch (err) {
    console.error('[verify] failed to send verification email:', err)
  }
}
