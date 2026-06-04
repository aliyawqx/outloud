import bcrypt from 'bcryptjs'

// Password hashing via bcrypt (vetted library — we never roll our own crypto).
const ROUNDS = 12

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
