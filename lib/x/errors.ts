// Typed errors for the X integration. Routes map these to clean HTTP responses.

export class XNotConnectedError extends Error {
  constructor() {
    super('Connect your X account first.')
    this.name = 'XNotConnectedError'
  }
}

export class XAuthError extends Error {
  constructor(message = 'X authorization failed. Reconnect your account.') {
    super(message)
    this.name = 'XAuthError'
  }
}

// Internal note (not user-facing): reading the user's timeline needs X API
// Basic+; the Free tier returns 403. The customer-facing message stays generic.
export class ImportNotAvailableError extends Error {
  constructor() {
    super("Importing your X posts isn't available right now. You can add posts manually instead.")
    this.name = 'ImportNotAvailableError'
  }
}

export class PublishError extends Error {
  constructor(message = 'Could not publish to X. Try again.') {
    super(message)
    this.name = 'PublishError'
  }
}

// Non-premium X accounts can't post longer than the free character limit. This
// is a policy limit, not a transient failure, so it gets its own clear message.
export class PostTooLongError extends Error {
  constructor(public readonly limit: number) {
    super(`Post exceeds the ${limit}-character limit for non-premium X accounts.`)
    this.name = 'PostTooLongError'
  }
}
