/**
 * @steward/ai — Transformer: Error Normalization
 *
 * Converts AI SDK errors (APICallError, NoSuchToolError, JSONParseError, TypeValidationError, etc.)
 * or generic JS errors into Steward AIError instances.
 * Pure function, no I/O.
 */

import { AIError, type AIErrorCode } from '../errors.js';
import type { ProviderId } from '../types.js';

export function normalizeError(err: unknown, providerId: ProviderId): AIError {
  if (err instanceof AIError) {
    return err;
  }

  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name : '';
    const message = typeof e.message === 'string' ? e.message : String(err);
    const status = typeof e.statusCode === 'number' ? e.statusCode : (typeof e.status === 'number' ? e.status : undefined);

    // Check specific SDK error classes/names
    if (name === 'APICallError') {
      let code: AIErrorCode = 'network';
      if (status === 401 || status === 403) code = 'auth';
      else if (status === 429) code = 'rate-limit';
      else if (status === 413) code = 'context-overflow';
      else if (status && status >= 500) code = 'provider';
      else if (status && status >= 400) code = 'invalid-request';

      return new AIError(message, {
        code,
        provider: providerId,
        status,
        retryable: typeof e.isRetryable === 'boolean' ? e.isRetryable : undefined,
        cause: err,
      });
    }

    if (name === 'NoSuchToolError' || name === 'TypeValidationError' || name === 'JSONParseError') {
      return new AIError(message, {
        code: 'parse',
        provider: providerId,
        cause: err,
      });
    }

    if (name === 'AbortError' || message.toLowerCase().includes('abort')) {
      return new AIError(message, {
        code: 'aborted',
        provider: providerId,
        cause: err,
      });
    }

    return new AIError(message, {
      code: 'provider',
      provider: providerId,
      status,
      cause: err,
    });
  }

  return new AIError(String(err), {
    code: 'provider',
    provider: providerId,
    cause: err,
  });
}
