import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the Anthropic SDK so no real network/LLM call happens.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

process.env.ANTHROPIC_API_KEY = 'test-key'

import { generateDrafts, captureVoice, type VoiceProfile } from './anthropic'

const profile: VoiceProfile = {
  summary: 'lowercase, short lines, dry humor, no emoji',
  samples: ['lost a customer to a 2am bug. lesson: stop shipping at 2am', 'MRR flat 3 months. ok slightly panicking'],
}

beforeEach(() => createMock.mockReset())

describe('generateDrafts', () => {
  it('parses structured drafts and feeds voice + input into the prompt', async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            drafts: [
              { angle: 'technical', hook: 'h', story: 's', offer: 'o', fullText: 'h\n\ns\n\no' },
              { angle: 'personal', hook: 'h2', story: 's2', offer: 'o2', fullText: 'h2\n\ns2\n\no2' },
            ],
          }),
        },
      ],
    })

    const drafts = await generateDrafts(profile, { input: 'shipped dark mode + 2x faster export' })

    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({ angle: 'technical', hook: 'h', fullText: 'h\n\ns\n\no' })

    const args = createMock.mock.calls[0][0]
    // HSO + anti-slop rules present
    expect(args.system[0].text).toContain('POST STRUCTURE')
    expect(args.system[0].text).toContain('NO AI-isms')
    // Voice samples injected
    expect(JSON.stringify(args.system)).toContain('stop shipping at 2am')
    // Structured output requested
    expect(args.output_config.format.type).toBe('json_schema')
    // The user's shipped input is in the message
    expect(args.messages[0].content).toContain('shipped dark mode + 2x faster export')
  })

  it('prepends the Day N/56 header when challengeDay is set', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: '', fullText: 'shipped the thing today' }] }) }],
    })
    const [withCount] = await generateDrafts(profile, { input: 'x', challengeDay: 5, followerCount: 340 })
    expect(withCount.fullText).toBe('Day 5/56 · 340 followers\n\nshipped the thing today')

    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: '', fullText: 'body' }] }) }],
    })
    const [noCount] = await generateDrafts(profile, { input: 'x', challengeDay: 5 })
    expect(noCount.fullText).toBe('Day 5/56\n\nbody')
  })

  it('respects hook intensity', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'f' }] }) }],
    })
    await generateDrafts(profile, { input: 'x', hookIntensity: 'spicy' })
    expect(createMock.mock.calls[0][0].messages[0].content).toContain('SPICY')
  })

  it('throws on non-JSON output', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'oops not json' }] })
    await expect(generateDrafts(profile, { input: 'x' })).rejects.toThrow()
  })
})

describe('captureVoice', () => {
  it('returns the extracted fingerprint text', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: '- lowercase\n- short lines' }] })
    const fp = await captureVoice(['a', 'b'])
    expect(fp).toContain('lowercase')
  })
})
