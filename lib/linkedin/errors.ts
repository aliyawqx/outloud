// Typed publish/auth errors — the scheduler's executor branches on these to
// classify terminal vs transient failures (mirrors lib/x/errors.ts).

export class LinkedInNotConnectedError extends Error {
  constructor(message = 'LinkedIn is not connected.') {
    super(message)
    this.name = 'LinkedInNotConnectedError'
  }
}

/** Dead/invalid token or missing w_member_social — recovery is re-auth. */
export class LinkedInAuthError extends Error {
  constructor(message = 'LinkedIn auth failed.') {
    super(message)
    this.name = 'LinkedInAuthError'
  }
}

export class LinkedInPostTooLongError extends Error {
  limit: number
  constructor(limit: number) {
    super(`LinkedIn posts are limited to ${limit} characters.`)
    this.name = 'LinkedInPostTooLongError'
    this.limit = limit
  }
}

/** ~100 posting calls/day per member — back off and requeue, never fail (spec §6). */
export class LinkedInRateLimitError extends Error {
  constructor(message = 'LinkedIn rate limit reached.') {
    super(message)
    this.name = 'LinkedInRateLimitError'
  }
}

/** The pinned LinkedIn-Version month was rejected — bump LINKEDIN_API_VERSION. */
export class LinkedInVersionError extends Error {
  constructor(message = 'LinkedIn API version rejected - bump LINKEDIN_API_VERSION (lib/linkedin/config.ts).') {
    super(message)
    this.name = 'LinkedInVersionError'
  }
}

export class LinkedInPublishError extends Error {
  constructor(message = 'LinkedIn rejected the post.') {
    super(message)
    this.name = 'LinkedInPublishError'
  }
}
