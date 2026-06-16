import { createHmac, timingSafeEqual } from 'node:crypto'

// Meta's uninstall/delete callbacks POST a `signed_request` = base64url(sig) "."
// base64url(payload). `sig` is HMAC-SHA256 of the payload STRING (the part after
// the dot) keyed by the app secret. We verify the signature before trusting the
// payload, which carries the Threads `user_id` of the person who uninstalled or
// asked for deletion. Mirrors Facebook's signed_request scheme.

export type SignedRequestPayload = {
  user_id?: string
  algorithm?: string
  issued_at?: number
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/** Verify + parse a signed_request. Returns null if malformed or the signature
 *  doesn't match the app secret. */
export function parseSignedRequest(signedRequest: string, appSecret: string): SignedRequestPayload | null {
  if (!signedRequest || typeof signedRequest !== 'string') return null
  const dot = signedRequest.indexOf('.')
  if (dot <= 0) return null
  const encodedSig = signedRequest.slice(0, dot)
  const encodedPayload = signedRequest.slice(dot + 1)

  let sig: Buffer
  try {
    sig = base64UrlDecode(encodedSig)
  } catch {
    return null
  }
  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest()
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null

  try {
    const json = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as SignedRequestPayload
    if (json.algorithm && json.algorithm.toUpperCase() !== 'HMAC-SHA256') return null
    return json
  } catch {
    return null
  }
}
