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

/** Reading the user's timeline needs X API Basic+ (Free tier returns 403). */
export class ImportNotAvailableError extends Error {
  constructor() {
    super('Importing your X posts needs X API Basic access. Publishing still works.')
    this.name = 'ImportNotAvailableError'
  }
}

export class PublishError extends Error {
  constructor(message = 'Could not publish to X. Try again.') {
    super(message)
    this.name = 'PublishError'
  }
}
