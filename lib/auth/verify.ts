import { randomInt } from 'node:crypto'
import { ensureSchema, getPool } from '@/lib/db'

// Email verification: a 6-digit code is stored on the user after signup and
// checked when they enter it. Codes expire after CODE_TTL.

const CODE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export type VerifyResult = 'ok' | 'already' | 'invalid' | 'expired'

/** Pure decision: given the stored row + entered code + now, what's the result? */
export function decideVerify(
  row: { emailVerified: boolean; code: string | null; expires: Date | null } | null,
  entered: string,
  now: Date,
): VerifyResult {
  if (!row) return 'invalid'
  if (row.emailVerified) return 'already'
  if (!row.code || !row.expires) return 'invalid'
  if (row.expires.getTime() < now.getTime()) return 'expired'
  if (row.code !== entered.trim()) return 'invalid'
  return 'ok'
}

/** Generate, store, and return a fresh verification code for a user. */
export async function setVerifyCode(userId: string): Promise<string> {
  await ensureSchema()
  const code = generateCode()
  await getPool().query(
    'UPDATE users SET verify_code = $1, verify_code_expires = $2 WHERE id = $3',
    [code, new Date(Date.now() + CODE_TTL_MS), userId],
  )
  return code
}

/** Check a code; on success mark the user verified and clear the code. */
export async function verifyCode(userId: string, entered: string): Promise<VerifyResult> {
  await ensureSchema()
  const { rows } = await getPool().query<{ email_verified: boolean; verify_code: string | null; verify_code_expires: Date | null }>(
    'SELECT email_verified, verify_code, verify_code_expires FROM users WHERE id = $1',
    [userId],
  )
  const r = rows[0]
  const result = decideVerify(
    r ? { emailVerified: r.email_verified, code: r.verify_code, expires: r.verify_code_expires } : null,
    entered,
    new Date(),
  )
  if (result === 'ok') {
    await getPool().query(
      'UPDATE users SET email_verified = true, verify_code = NULL, verify_code_expires = NULL WHERE id = $1',
      [userId],
    )
  }
  return result
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  await ensureSchema()
  const { rows } = await getPool().query<{ email_verified: boolean }>(
    'SELECT email_verified FROM users WHERE id = $1',
    [userId],
  )
  return rows[0]?.email_verified ?? false
}
