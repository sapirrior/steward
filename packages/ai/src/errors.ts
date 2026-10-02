/**
 * @steward/ai - Error Taxonomy and HTTP Error Classification
 */

import type { ProviderId } from './types.js';
import { isOverflowText } from './util/overflow.js';
import { parseProviderError } from './util/error-body.js';

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
  /**
   * Provider-specific error type string from the response envelope,
   * e.g. "overloaded_error", "rate_limit_error", "insufficient_quota".
   */
  providerType?: string;
  /** Retry-After delay in milliseconds, when the provider specifies one. */
  retryAfterMs?: number;
  /** Redacted HTTP body detail — never contains secrets. Kept separate from the short `message`. */
  detail?: string;
  cause?: unknown;
}

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly provider?: ProviderId;
  readonly status?: number;
  readonly retryable: boolean;
  /** Provider-specific error type string, e.g. "overloaded_error". */
  readonly providerType?: string;
  /** Retry delay in milliseconds if the provider returned a Retry-After header. */
  readonly retryAfterMs?: number;
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
    this.providerType = options.providerType;
    this.retryAfterMs = options.retryAfterMs;
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
 * Uses parseProviderError to extract a clean message — never embeds raw JSON in AIError.message.
 */
export function classifyHttpError(
  status: number,
  bodyText?: string,
  provider?: ProviderId,
  cause?: unknown,
): AIError {
  const parsed = bodyText ? parseProviderError(bodyText) : {};
  const providerMessage = parsed.message;
  const providerType = parsed.type;
  const providerCode = parsed.code;

  let code: AIErrorCode = 'provider';
  let retryable = false;
  let message: string;

  if (status === 401 || status === 403) {
    code = 'auth';
    message = providerMessage
      ? `Authentication failed (HTTP ${status}): ${providerMessage}`
      : `Authentication failed (HTTP ${status}) for provider "${provider ?? 'unknown'}".`;
  } else if (status === 429) {
    code = 'rate-limit';
    retryable = true;
    // Distinguish quota exhaustion (not retryable) from rate limiting
    if (providerCode === 'insufficient_quota' || providerType === 'insufficient_quota') {
      retryable = false;
      message = `Quota or credit exhausted for provider "${provider ?? 'unknown'}".`;
    } else {
      message = providerMessage
        ? `Rate limited (HTTP 429): ${providerMessage}`
        : `Rate limit exceeded (HTTP 429) for provider "${provider ?? 'unknown'}".`;
    }
  } else if (status === 413 || (bodyText && isOverflowText(bodyText))) {
    code = 'context-overflow';
    message = `Context overflow: request exceeded context length limits.`;
  } else if (status === 400 || status === 404 || status === 422) {
    code = 'invalid-request';
    message = providerMessage
      ? `Invalid request (HTTP ${status}): ${providerMessage}`
      : `Invalid request (HTTP ${status}).`;
  } else if (status === 408 || status === 409 || (status >= 500 && status <= 599)) {
    code = 'provider';
    retryable = true;
    // 529 is Anthropic's overloaded status
    if (
      status === 529 ||
      providerType === 'overloaded_error' ||
      providerType === 'api_error'
    ) {
      message = providerMessage
        ? `Provider overloaded (HTTP ${status}): ${providerMessage}`
        : `Provider "${provider ?? 'unknown'}" is overloaded (HTTP ${status}).`;
    } else {
      message = providerMessage
        ? `Provider error (HTTP ${status}): ${providerMessage}`
        : `Provider returned error (HTTP ${status}).`;
    }
  } else {
    message = providerMessage
      ? `Request failed (HTTP ${status}): ${providerMessage}`
      : `Request failed with HTTP status ${status}`;
  }

  return new AIError(message, {
    code,
    provider,
    status,
    retryable,
    providerType,
    detail: bodyText,
    cause,
  });
}
