/**
 * @steward/ai - Error Taxonomy and HTTP Error Classification
 */

import type { ProviderId } from './types.js';
import { isOverflowText } from './util/overflow.js';

export type AIErrorCode =
  | 'auth'
  | 'network'
  | 'rate-limit'
  | 'invalid-request'
  | 'context-overflow'
  | 'provider'
  | 'parse'
  | 'aborted';

export interface AIErrorOptions {
  code: AIErrorCode;
  provider?: ProviderId;
  status?: number;
  retryable?: boolean;
  /** Redacted HTTP body detail — never contains secrets. Kept separate from the short `message`. */
  detail?: string;
  cause?: unknown;
}

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly provider?: ProviderId;
  readonly status?: number;
  readonly retryable: boolean;
  /** Redacted HTTP body detail. Present only when the server returned a readable body. */
  readonly detail?: string;
  readonly cause?: unknown;

  constructor(message: string, options: AIErrorOptions) {
    super(message);
    this.name = 'AIError';
    this.code = options.code;
    this.provider = options.provider;
    this.status = options.status;
    this.detail = options.detail;
    this.retryable =
      options.retryable ?? (options.code === 'rate-limit' || options.code === 'network');
    this.cause = options.cause;

    // Maintain prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toString(): string {
    const providerStr = this.provider ? ` [${this.provider}]` : '';
    const statusStr = this.status ? ` (HTTP ${this.status})` : '';
    return `AIError(${this.code})${providerStr}${statusStr}: ${this.message}`;
  }
}

/**
 * Classifies raw HTTP response status codes and redacted error bodies into canonical AIErrors.
 */
export function classifyHttpError(
  status: number,
  bodyText?: string,
  provider?: ProviderId,
  cause?: unknown,
): AIError {
  let code: AIErrorCode = 'provider';
  let retryable = false;
  let message = `Request failed with HTTP status ${status}`;

  if (status === 401 || status === 403) {
    code = 'auth';
    message = `Authentication failed (HTTP ${status}) for provider "${provider ?? 'unknown'}".`;
  } else if (status === 429) {
    code = 'rate-limit';
    retryable = true;
    message = `Rate limit exceeded (HTTP 429) for provider "${provider ?? 'unknown'}".`;
  } else if (status === 413 || (bodyText && isOverflowText(bodyText))) {
    code = 'context-overflow';
    message = `Context overflow: request exceeded context length limits.`;
  } else if (status === 400 || status === 404 || status === 422) {
    code = 'invalid-request';
    message = `Invalid request (HTTP ${status})${bodyText ? `: ${bodyText}` : ''}`;
  } else if (status === 408 || status === 409 || (status >= 500 && status <= 599)) {
    code = 'provider';
    retryable = true;
    message = `Provider returned error (HTTP ${status}).`;
  }

  return new AIError(message, {
    code,
    provider,
    status,
    retryable,
    detail: bodyText,
    cause,
  });
}
