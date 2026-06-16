// Typed errors for the Threads integration. Routes map these to clean HTTP
// responses. Mirrors lib/x/errors.ts.

export class ThreadsNotConnectedError extends Error {
  constructor() {
    super('Connect your Threads account first.')
    this.name = 'ThreadsNotConnectedError'
  }
}

export class ThreadsAuthError extends Error {
  constructor(message = 'Threads authorization failed. Reconnect your account.') {
    super(message)
    this.name = 'ThreadsAuthError'
  }
}

// Threads caps text posts at 500 characters. A policy limit, not a transient
// failure, so it gets its own clear message (validated before we ever publish).
export class ThreadsPostTooLongError extends Error {
  constructor(public readonly limit: number) {
    super(`Post exceeds the ${limit}-character limit for Threads.`)
    this.name = 'ThreadsPostTooLongError'
  }
}

// 250 publications / 24h per user. Surfaced after backoff retries are exhausted.
export class ThreadsRateLimitError extends Error {
  constructor() {
    super('Threads is rate-limiting your account (250 posts/24h). Try again later.')
    this.name = 'ThreadsRateLimitError'
  }
}

export class ThreadsPublishError extends Error {
  constructor(message = 'Could not publish to Threads. Try again.') {
    super(message)
    this.name = 'ThreadsPublishError'
  }
}

// Topic search (keyword_search) hit Meta's per-user cap (2200 requests / 24h).
export class ThreadsSearchRateLimitError extends Error {
  constructor() {
    super('Threads topic search hit its daily limit. Try again later.')
    this.name = 'ThreadsSearchRateLimitError'
  }
}

// keyword_search needs the threads_keyword_search permission. Without it Meta only
// returns the user's OWN posts (or errors), so topic search isn't usable yet.
export class ThreadsSearchNotApprovedError extends Error {
  constructor() {
    super("Topic search on Threads isn't enabled for your account yet.")
    this.name = 'ThreadsSearchNotApprovedError'
  }
}

// Any other failure reading the keyword_search endpoint.
export class ThreadsSearchUnavailableError extends Error {
  constructor(message = "Threads topic search isn't available right now. Try again.") {
    super(message)
    this.name = 'ThreadsSearchUnavailableError'
  }
}
