import nodemailer from 'nodemailer'
import { Resend } from 'resend'

// Sends the email-verification code to a new user. Non-fatal by design: if no
// transport is configured or the send fails, we log and return so signup never
// breaks. The caller treats this as best-effort.
//
// Transport selection (first one configured wins):
//   1. Gmail SMTP  — GMAIL_USER + GMAIL_APP_PASSWORD. Delivers to ANY address,
//      no domain needed (good for low volume, ~500/day).
//   2. Resend      — RESEND_API_KEY. The test sender only delivers to the Resend
//      account owner until a domain is verified; set VERIFY_EMAIL_FROM then.
//   3. Dev log     — nothing configured: the code is logged so the flow stays
//      testable. Also always logged in non-production.

const SUBJECT = (code: string) => `Your Outloud verification code: ${code}`
const BODY = (code: string) =>
  `Welcome to Outloud.\n\nYour verification code is ${code}.\n\nEnter it to finish setting up your account. It expires in 15 minutes.\n\nIf you didn't sign up, you can ignore this email.`

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[verify] code for ${email}: ${code}`)
  }

  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD
  if (gmailUser && gmailPass) {
    await sendViaGmail({ user: gmailUser, pass: gmailPass, to: email, code })
    return
  }

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    await sendViaResend({ apiKey: resendKey, to: email, code })
    return
  }

  console.warn('[verify] no email transport configured (GMAIL_* or RESEND_API_KEY) — code only logged')
}

async function sendViaGmail(opts: { user: string; pass: string; to: string; code: string }): Promise<void> {
  // Gmail app password (not the account password): requires 2FA enabled.
  const transport = nodemailer.createTransport({
    service: 'gmail',
    // Gmail shows app passwords with spaces; they must be stripped before use.
    auth: { user: opts.user, pass: opts.pass.replace(/\s+/g, '') },
  })
  const from = process.env.VERIFY_EMAIL_FROM || `Outloud <${opts.user}>`
  try {
    const info = await transport.sendMail({
      from,
      to: opts.to,
      subject: SUBJECT(opts.code),
      text: BODY(opts.code),
    })
    console.log('[verify] code email sent via Gmail to', opts.to, 'id:', info.messageId)
  } catch (err) {
    console.error('[verify] Gmail send failed:', err)
  }
}

async function sendViaResend(opts: { apiKey: string; to: string; code: string }): Promise<void> {
  const resend = new Resend(opts.apiKey)
  const from = process.env.VERIFY_EMAIL_FROM || 'Outloud <onboarding@resend.dev>'
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: SUBJECT(opts.code),
      text: BODY(opts.code),
    })
    if (error) {
      console.error('[verify] Resend returned an error:', error)
    } else {
      console.log('[verify] code email sent via Resend to', opts.to, 'id:', data?.id)
    }
  } catch (err) {
    console.error('[verify] Resend send failed:', err)
  }
}
