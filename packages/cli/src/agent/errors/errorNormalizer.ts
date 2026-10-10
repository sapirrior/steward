import { APICallError, LoadAPIKeyError, RetryError, StreamProviderError } from 'ai';
import { AgentError } from './AgentError.js';
import type { ModelRef } from '@steward/models';

export interface NormalizeErrorOptions {
  modelRef?: ModelRef | string;
  signal?: AbortSignal;
}

/**
 * Parses HTTP Retry-After header value into milliseconds.
 * Can be either integer seconds (e.g. "5") or HTTP date.
 */
function parseRetryAfter(headerValue?: string): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number.parseInt(headerValue, 10);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }
  return undefined;
}

/**
 * Normalizes any raw error into a structured, concise, user-friendly AgentError.
 */
export function normalizeAgentError(
  rawError: unknown,
  options?: NormalizeErrorOptions,
): AgentError {
  if (rawError instanceof AgentError) {
    return rawError;
  }

  let provider: string | undefined;
  let modelId: string | undefined;

  if (typeof options?.modelRef === 'string') {
    const slash = options.modelRef.indexOf('/');
    if (slash > 0) {
      provider = options.modelRef.slice(0, slash);
      modelId = options.modelRef.slice(slash + 1);
    } else {
      modelId = options.modelRef;
    }
  } else if (options?.modelRef) {
    provider = options.modelRef.provider;
    modelId = options.modelRef.modelId;
  }

  // 1. Check for user cancellation / abort
  if (
    options?.signal?.aborted ||
    (rawError instanceof Error && rawError.name === 'AbortError') ||
    (rawError as { code?: string })?.code === 'ABORT_ERR'
  ) {
    return new AgentError({
      code: 'ABORTED',
      message: 'Operation canceled by user.',
      provider,
      modelId,
      retryable: false,
      rawCause: rawError,
    });
  }

  // 2. Unwrap RetryError to inspect the true underlying failure
  let currentError: unknown = rawError;
  if (RetryError.isInstance(rawError)) {
    currentError = rawError.lastError ?? rawError;
  }

  // 3. AI SDK LoadAPIKeyError
  if (LoadAPIKeyError.isInstance(currentError)) {
    const provName = provider ? ` for provider '${provider}'` : '';
    const loginHint =
      provider === 'openrouter' || provider === 'github-copilot'
        ? ` Run 'steward login ${provider}' or set your environment key.`
        : provider
          ? ` Please set the environment variable for ${provider.toUpperCase()}_API_KEY.`
          : '';

    return new AgentError({
      code: 'AUTH_MISSING',
      message: `Authentication missing${provName}.${loginHint}`,
      provider,
      modelId,
      retryable: false,
      rawCause: rawError,
    });
  }

  // 4. AI SDK APICallError
  if (APICallError.isInstance(currentError)) {
    const status = currentError.statusCode;
    const retryAfterMs = parseRetryAfter(currentError.responseHeaders?.['retry-after']);

    if (status === 401 || status === 403) {
      const loginHint =
        provider === 'openrouter' || provider === 'github-copilot'
          ? ` Run 'steward login ${provider}' to re-authenticate.`
          : ' Check your API key permissions and balance.';

      return new AgentError({
        code: 'AUTH_INVALID',
        message: `Authentication failed (HTTP ${status})${provider ? ` for provider '${provider}'` : ''}.${loginHint}`,
        provider,
        modelId,
        status,
        retryable: false,
        rawCause: rawError,
      });
    }

    if (status === 429) {
      return new AgentError({
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded${provider ? ` on ${provider}` : ''}. Waiting before retry.`,
        provider,
        modelId,
        status,
        retryable: true,
        retryAfterMs,
        rawCause: rawError,
      });
    }

    if (status === 503 || status === 529 || (status && status >= 500 && status < 600)) {
      return new AgentError({
        code: 'SERVER_OVERLOADED',
        message: `Model provider service is temporarily unavailable or overloaded (HTTP ${status}).`,
        provider,
        modelId,
        status,
        retryable: true,
        retryAfterMs,
        rawCause: rawError,
      });
    }

    const msg = currentError.message || `API call failed with status ${status}`;
    // Check for context length exceed in message or response
    if (/context.*length|token.*limit|maximum.*context/i.test(msg)) {
      return new AgentError({
        code: 'CONTEXT_LENGTH_EXCEEDED',
        message: 'Context window limit exceeded for this model.',
        provider,
        modelId,
        status,
        retryable: false,
        rawCause: rawError,
      });
    }

    return new AgentError({
      code: 'UNKNOWN',
      message: msg,
      provider,
      modelId,
      status,
      retryable: currentError.isRetryable,
      retryAfterMs,
      rawCause: rawError,
    });
  }

  // 5. StreamProviderError
  if (StreamProviderError.isInstance(currentError)) {
    const status = currentError.statusCode;
    return new AgentError({
      code: status === 429 ? 'RATE_LIMITED' : 'SERVER_OVERLOADED',
      message: currentError.message || 'Stream error from model provider.',
      provider,
      modelId,
      status,
      retryable: currentError.isRetryable ?? false,
      rawCause: rawError,
    });
  }

  // 6. Generic network & socket errors
  const errStr = String((currentError as { message?: string })?.message || currentError);
  const code = (currentError as { code?: string })?.code;

  if (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    /fetch failed|network timeout|socket hang up/i.test(errStr)
  ) {
    return new AgentError({
      code: 'NETWORK_ERROR',
      message: 'Network connection failed while communicating with model provider.',
      provider,
      modelId,
      retryable: true,
      rawCause: rawError,
    });
  }

  // 7. Context length regex fallback
  if (/context.*length|token.*limit|maximum.*context/i.test(errStr)) {
    return new AgentError({
      code: 'CONTEXT_LENGTH_EXCEEDED',
      message: 'Context window limit exceeded for this model.',
      provider,
      modelId,
      retryable: false,
      rawCause: rawError,
    });
  }

  // 8. Fallback for unclassified errors
  return new AgentError({
    code: 'UNKNOWN',
    message: errStr || 'An unexpected agent error occurred.',
    provider,
    modelId,
    retryable: false,
    rawCause: rawError,
  });
}
