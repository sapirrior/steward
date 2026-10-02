/**
 * Domain error class for OAuth operations.
 * Redacts secret tokens from messages and stack traces.
 */
export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      'oauth' | 'aborted' | 'timeout' | 'cancelled' | 'unsupported_provider' = 'oauth',
    public readonly provider?: string,
    cause?: unknown,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = 'OAuthError';
  }
}
