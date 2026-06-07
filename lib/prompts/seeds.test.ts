import { describe, expect, it } from 'vitest'
import { DEFAULT_COMMAND, SEED_PROMPTS, seedText } from './seeds'
import { normalizeCommand } from './store'

describe('seed library', () => {
  it('has the starter commands with unique names and non-empty text', () => {
    const commands = SEED_PROMPTS.map((p) => p.command)
    expect(commands).toContain('post')
    expect(commands).toContain('reply')
    expect(commands).toContain('thread')
    expect(new Set(commands).size).toBe(commands.length) // unique
    for (const p of SEED_PROMPTS) expect(p.text.trim().length).toBeGreaterThan(20)
  })

  it('default command resolves to the post format', () => {
    expect(DEFAULT_COMMAND).toBe('post')
    expect(seedText('post')).toBeDefined()
    expect(seedText('nope')).toBeUndefined()
  })
})

describe('normalizeCommand', () => {
  it('strips the leading slash, lowercases, keeps a-z0-9 and dashes', () => {
    expect(normalizeCommand('/Thread')).toBe('thread')
    expect(normalizeCommand('Cold Email!')).toBe('coldemail')
    expect(normalizeCommand('/cold-email')).toBe('cold-email')
    expect(normalizeCommand('  /POST  ')).toBe('post')
  })
})
