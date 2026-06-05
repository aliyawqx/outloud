import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the Anthropic SDK so no real network/LLM call happens.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

process.env.ANTHROPIC_API_KEY = 'test-key'

import { generateDrafts, generateStyleGuide, captureVoice, type VoiceProfile } from './anthropic'

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

describe('generateDrafts with a captured Style Guide', () => {
  it('injects the style guide + raw sample anchors into the system prompt', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'f' }] }) }],
    })
    await generateDrafts(
      { styleGuide: '## Sentence Architecture\nshort additive clauses joined by and', samples: ['shipped at 2am again'] },
      { input: 'shipped billing' },
    )
    const sys = JSON.stringify(createMock.mock.calls[0][0].system)
    expect(sys).toContain('Captured Style Guide')
    expect(sys).toContain('short additive clauses')
    expect(sys).toContain('shipped at 2am again') // raw sample anchor
  })
})

describe('generateStyleGuide', () => {
  it('runs the universal analysis prompt over the samples and returns the guide', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ summary: 'dry, lowercase, additive', guideMarkdown: '## Voice summary\ndry' }) }],
    })
    const r = await generateStyleGuide(['пост на русском', 'a punchy english line'])
    expect(r.summary).toBe('dry, lowercase, additive')
    expect(r.guideMarkdown).toContain('Voice summary')

    const args = createMock.mock.calls[0][0]
    // universal style-analysis meta-prompt drives it
    expect(args.system[0].text).toContain('writing-style analyst')
    // samples are passed in the user message
    expect(args.messages[0].content).toContain('a punchy english line')
    expect(args.output_config.format.type).toBe('json_schema')
  })

  it('throws when there are no samples', async () => {
    await expect(generateStyleGuide([])).rejects.toThrow(/No samples/)
  })
})

describe('captureVoice', () => {
  it('returns the extracted fingerprint text', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: '- lowercase\n- short lines' }] })
    const fp = await captureVoice(['a', 'b'])
    expect(fp).toContain('lowercase')
  })
})
