import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM. Stored format: base64( iv[12] | authTag[16] | ciphertext ).
// Mirrors lib/x/crypto.ts but uses its own key so the integrations can be
// rotated independently.

function key(): Buffer {
  const raw = process.env.LINKEDIN_TOKEN_ENC_KEY
  if (!raw) throw new Error('LINKEDIN_TOKEN_ENC_KEY is not set')
  const k = Buffer.from(raw, 'base64')
  if (k.length !== 32) throw new Error('LINKEDIN_TOKEN_ENC_KEY must decode to 32 bytes (base64)')
  return k
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
