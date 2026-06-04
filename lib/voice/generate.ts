import type { DraftPost, GeneratePostInput } from './types'

/**
 * Thrown by the Phase-1 `generatePost` stub. The Voice Inspiration system builds
 * the `voiceProfile` that this function will consume; the generation body lands
 * in a later phase.
 */
export class NotImplementedError extends Error {
  constructor(message = 'generatePost is not implemented yet (Phase 1: voice layer only)') {
    super(message)
    this.name = 'NotImplementedError'
  }
}

/**
 * THE SEAM. The future AI Post Composer plugs in here and nowhere else: it
 * receives a fully-built {@link GeneratePostInput} (idea + a saved/blended
 * VoiceProfile) and returns a {@link DraftPost}.
 *
 * Phase 1 intentionally does NOT generate text. It throws so callers and tests
 * fail loudly rather than silently shipping a placeholder to users. When wiring
 * generation, map `input.voiceProfile` → the generator's voice input (see
 * lib/anthropic.ts `generateDrafts`) and implement the body here.
 *
 * // TODO(phase-2): implement via the Claude generation core.
 */
export async function generatePost(input: GeneratePostInput): Promise<DraftPost> {
  void input
  throw new NotImplementedError()
}
