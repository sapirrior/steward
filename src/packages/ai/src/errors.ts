/**
 * @steward/ai - Error Taxonomy
 */

import type { ProviderId } from './types.js';

export type AIErrorCode =
  | 'auth'
  | 'oauth'
  | 'network'
  | 'rate-limit'
  | 'invalid-request'
  | 'provider'
  | 'parse'
  | 'aborted';

export interface AIErrorOptions {
  code: AIErrorCode;
  provider?: ProviderId;
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly provider?: ProviderId;
  readonly status?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(message: string, options: AIErrorOptions) {
    super(message);
    this.name = 'AIError';
    this.code = options.code;
    this.provider = options.provider;
    this.status = options.status;
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
