import { Resend } from 'resend'

const DEFAULT_TO = 'zhanabayaliya@gmail.com'

/**
 * Notify the operator by email when someone joins the early-access list.
 * Non-fatal: if Resend isn't configured or the send fails, we log and move on
 * so the signup itself always succeeds.
 */
export async function sendSignupNotification(input: {
  handle: string
  shipping: string | null
  alreadyOnList: boolean
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notify] RESEND_API_KEY not set — skipping email notification')
    return
  }

  const to = process.env.NOTIFY_EMAIL || DEFAULT_TO
  const resend = new Resend(apiKey)

  const status = input.alreadyOnList ? '(returning — updated)' : '(new)'
  const subject = `New Outloud early-access: @${input.handle} ${status}`
  const lines = [
    `X handle: @${input.handle}`,
    `Shipping: ${input.shipping ?? '—'}`,
    '',
    `Profile: https://x.com/${input.handle}`,
    input.alreadyOnList ? 'Note: this handle was already on the list.' : '',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const { data, error } = await resend.emails.send({
      from: 'Outloud <onboarding@resend.dev>',
      to,
      subject,
      text: lines,
    })
    if (error) {
      console.error('[notify] Resend returned an error:', error)
    } else {
      console.log('[notify] email sent to', to, 'id:', data?.id)
    }
  } catch (err) {
    console.error('[notify] failed to send signup email:', err)
  }
}
