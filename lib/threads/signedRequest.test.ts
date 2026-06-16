import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseSignedRequest } from './signedRequest'

const SECRET = 'test-secret'

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function makeSignedRequest(payload: object, secret = SECRET): string {
  const encodedPayload = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64url(createHmac('sha256', secret).update(encodedPayload).digest())
  return `${sig}.${encodedPayload}`
}

describe('parseSignedRequest', () => {
  it('verifies a correctly signed request and returns the payload', () => {
    const sr = makeSignedRequest({ user_id: '17841400000000000', algorithm: 'HMAC-SHA256', issued_at: 1700000000 })
    expect(parseSignedRequest(sr, SECRET)).toMatchObject({ user_id: '17841400000000000' })
  })

  it('rejects a request signed with the wrong secret', () => {
    const sr = makeSignedRequest({ user_id: '1' }, 'wrong-secret')
    expect(parseSignedRequest(sr, SECRET)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const sr = makeSignedRequest({ user_id: '1' })
    const tampered = sr.split('.')[0] + '.' + b64url(Buffer.from(JSON.stringify({ user_id: '999' })))
    expect(parseSignedRequest(tampered, SECRET)).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(parseSignedRequest('', SECRET)).toBeNull()
    expect(parseSignedRequest('no-dot', SECRET)).toBeNull()
    expect(parseSignedRequest('.onlypayload', SECRET)).toBeNull()
  })

  it('rejects a non-HMAC-SHA256 algorithm', () => {
    const sr = makeSignedRequest({ user_id: '1', algorithm: 'PLAINTEXT' })
    expect(parseSignedRequest(sr, SECRET)).toBeNull()
  })
})
