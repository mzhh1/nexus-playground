export class AuthenticationError extends Error {
  name = 'AuthenticationError';

  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
  }
}

export class AuthorizationError extends Error {
  name = 'AuthorizationError';

  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
  }
}

export class ServerError extends Error {
  name = 'ServerError';

  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
  }
}
