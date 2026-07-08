import { describe, expect, it } from 'vitest'
import { validateAutopilotPost } from './validate'

describe('validateAutopilotPost', () => {
  it('accepts a compliant post', () => {
    expect(validateAutopilotPost('shipped a tiny fix today and it took three hours but the bug taught me more than the feature did')).toEqual({ ok: true })
  })
  it('accepts any casing — casing belongs to the voice, not the format', () => {
    expect(validateAutopilotPost('Shipped a fix today. It held.')).toEqual({ ok: true })
  })
  it('rejects empty or whitespace-only output', () => {
    expect(validateAutopilotPost('')).toEqual({ ok: false, reason: 'empty' })
    expect(validateAutopilotPost('   \n ')).toEqual({ ok: false, reason: 'empty' })
  })
  it('rejects em-dashes', () => {
    expect(validateAutopilotPost('shipped a fix — finally')).toEqual({ ok: false, reason: 'em-dash' })
  })
  it('rejects urls anywhere in the body', () => {
    expect(validateAutopilotPost('read more at https://example.com')).toEqual({ ok: false, reason: 'url' })
    expect(validateAutopilotPost('see www.example.com for details')).toEqual({ ok: false, reason: 'url' })
  })
  it('rejects posts over the platform cap', () => {
    expect(validateAutopilotPost('a'.repeat(281))).toEqual({ ok: false, reason: 'too-long' })
    expect(validateAutopilotPost('a'.repeat(280))).toEqual({ ok: true })
  })
})
