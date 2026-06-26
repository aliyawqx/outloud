import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the Anthropic SDK so no real network/LLM call happens.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    // `stream(...).finalMessage()` routes through the same mock as `create`, so a
    // single mockResolvedValue covers both the non-streaming and streaming paths.
    messages = {
      create: createMock,
      stream: (params: unknown) => ({ finalMessage: () => createMock(params) }),
    }
  },
}))

process.env.ANTHROPIC_API_KEY = 'test-key'

import { generateDrafts, generateStyleGuide, type VoiceProfile } from './anthropic'

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

    const { drafts } = await generateDrafts(profile, {
      input: 'shipped dark mode + 2x faster export',
      formatText: 'FORMAT: a standard X post (HOOK -> DEFUSE -> STORY -> BRIDGE -> OFFER).',
    })

    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({ angle: 'technical', hook: 'h', fullText: 'h\n\ns\n\no' })

    const args = createMock.mock.calls[0][0]
    // Global BASE rules in system[0] (anti-slop), format-agnostic
    expect(args.system[0].text).toContain('NO AI-isms')
    // The FORMAT (structure) is injected into the user message, not the system rules
    expect(args.messages[0].content).toContain('HOOK -> DEFUSE -> STORY -> BRIDGE -> OFFER')
    // Voice samples injected
    expect(JSON.stringify(args.system)).toContain('stop shipping at 2am')
    // Structured output requested
    expect(args.output_config.format.type).toBe('json_schema')
    // The user's shipped input is in the message
    expect(args.messages[0].content).toContain('shipped dark mode + 2x faster export')
  })

  it('prepends a generic, user-configured progress header when progressDay is set', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: '', fullText: 'shipped the thing today' }] }) }],
    })
    const { drafts: [withCount] } = await generateDrafts(profile, { input: 'x', progressDay: 5, progressTotal: 30, followerCount: 340 })
    expect(withCount.fullText).toBe('Day 5/30 · 340 followers\n\nshipped the thing today')

    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: '', fullText: 'body' }] }) }],
    })
    const { drafts: [noCount] } = await generateDrafts(profile, { input: 'x', progressDay: 5 })
    expect(noCount.fullText).toBe('Day 5\n\nbody')
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
    expect(sys).toContain('STYLE GUIDE for this writer')
    expect(sys).toContain('short additive clauses')
    expect(sys).toContain('shipped at 2am again') // raw sample anchor
  })
})

describe('voice is always per-user, with no built-in default voice', () => {
  beforeEach(() =>
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'f' }] }) }],
    }),
  )

  it("drives the voice on the user's own samples", async () => {
    await generateDrafts({ samples: ['my own raw post here'] }, { input: 'x' })
    const sys = JSON.stringify(createMock.mock.calls[0][0].system)
    expect(sys).toContain('my own raw post here') // their samples anchor the voice
  })

  it('throws VoiceRequiredError when there is no voice signal (no default voice)', async () => {
    await expect(generateDrafts({}, { input: 'x' })).rejects.toThrow(/voice is required/i)
    expect(createMock).not.toHaveBeenCalled() // never calls the model without a voice
  })
})

describe('generation rules', () => {
  it('returns a clarifying ask (no drafts) when the idea is unclear', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ clarify: 'что именно ты сделал? опиши подробнее.', drafts: [] }) }],
    })
    const r = await generateDrafts(profile, { input: 'asdfgh' })
    expect(r.drafts).toHaveLength(0)
    expect(r.clarify).toContain('подробнее')
  })

  it('strips long em/en dashes from generated text', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'shipped it — finally', story: 's – more', offer: 'o', fullText: 'shipped it — finally\n\ns – more' }] }) }],
    })
    const { drafts } = await generateDrafts(profile, { input: 'x' })
    const all = JSON.stringify(drafts)
    expect(all).not.toMatch(/[—–―]/)
    expect(drafts[0].hook).toBe('shipped it - finally')
  })

  it('instructs the model to keep the idea’s language', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ drafts: [{ angle: 'a', hook: 'h', story: 's', offer: 'o', fullText: 'f' }] }) }],
    })
    await generateDrafts(profile, { input: 'запустил тёмную тему' })
    expect(createMock.mock.calls[0][0].messages[0].content).toContain('same language the user wrote the idea')
  })
})

describe('generateStyleGuide', () => {
  it('runs the universal voice-extraction prompt and returns the markdown profile + summary', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '## VOICE SUMMARY\ndry, lowercase, additive\n\n## TONE & ATTITUDE\nblunt' }],
    })
    const r = await generateStyleGuide(['пост на русском', 'a punchy english line'])
    // summary is pulled from the VOICE SUMMARY section
    expect(r.summary).toBe('dry, lowercase, additive')
    // the full markdown profile is kept as the guide
    expect(r.guideMarkdown).toContain('## VOICE SUMMARY')
    expect(r.guideMarkdown).toContain('## TONE & ATTITUDE')

    const args = createMock.mock.calls[0][0]
    expect(args.system[0].text).toContain('voice analyst') // the universal prompt
    expect(args.messages[0].content).toContain('a punchy english line') // samples passed in
  })

  it('throws when there are no samples', async () => {
    await expect(generateStyleGuide([])).rejects.toThrow(/No samples/)
  })
})
