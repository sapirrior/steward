import type { SDKErrorDetails, StewardSDKErrorKind } from './types.js';

export class StewardSDKError extends Error {
  readonly kind: StewardSDKErrorKind;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly retryAfterMs?: number;
  readonly provider?: string;
  readonly modelId?: string;

  constructor(details: SDKErrorDetails, options?: { cause?: unknown }) {
    super(details.message, options);
    this.name = 'StewardSDKError';
    this.kind = details.kind;
    this.retryable = details.retryable;
    this.statusCode = details.statusCode;
    this.retryAfterMs = details.retryAfterMs;
    this.provider = details.provider;
    this.modelId = details.modelId;

    // Ensure prototype chain is properly restored in all environments
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): SDKErrorDetails {
    return {
      kind: this.kind,
      message: this.message,
      retryable: this.retryable,
      ...(this.statusCode !== undefined && { statusCode: this.statusCode }),
      ...(this.retryAfterMs !== undefined && { retryAfterMs: this.retryAfterMs }),
      ...(this.provider !== undefined && { provider: this.provider }),
      ...(this.modelId !== undefined && { modelId: this.modelId }),
    };
  }
}

/**
 * Redacts secrets, Bearer tokens, and sensitive headers from error messages.
 */
export function redactSensitiveData(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:sk-[a-zA-Z0-9_-]{8,})/g, 'sk-***[REDACTED]***')
    .replace(/(?:xox[baprs]-[a-zA-Z0-9-]{10,})/g, 'xox-***[REDACTED]***')
    .replace(/(?:Bearer\s+)[a-zA-Z0-9_.\-/~+]+=*/gi, 'Bearer ***[REDACTED]***')
    .replace(/(?:api[-_]?key[\s:=]+)[a-zA-Z0-9_\-]{8,}/gi, 'api_key=***[REDACTED]***');
}

/**
 * Normalizes any caught error into a structured StewardSDKError.
 * If the error cannot be matched to a specific category (auth, rate-limit, etc.),
 * it falls back cleanly to the 'provider' default error kind.
 */
export function normalizeSDKError(
  error: unknown,
  context?: { provider?: string; modelId?: string },
): StewardSDKError {
  if (error instanceof StewardSDKError) {
    return error;
  }

  const provider = context?.provider;
  const modelId = context?.modelId;

  // Extract common error properties
  const err = error as Record<string, any> | null | undefined;
  const rawMessage =
    typeof err?.message === 'string' ? err.message : String(error ?? 'Unknown error');
  const message = redactSensitiveData(rawMessage);
  const status =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
        ? err.statusCode
        : undefined;

  // Extract Retry-After if present
  let retryAfterMs: number | undefined;
  if (err?.responseHeaders?.get) {
    const header = err.responseHeaders.get('retry-after');
    if (header) {
      const parsed = Number(header);
      if (!Number.isNaN(parsed)) {
        retryAfterMs = parsed * 1000;
      }
    }
  }

  // 1. Abort check
  if (
    err?.name === 'AbortError' ||
    (err?.name === 'DOMException' && err?.code === 20) ||
    /aborted|cancelled/i.test(message)
  ) {
    return new StewardSDKError(
      {
        kind: 'abort',
        message: 'The operation was aborted.',
        retryable: false,
        statusCode: status,
        provider,
        modelId,
      },
      { cause: error },
    );
  }

  // 2. Authentication check (401, 403, or AI SDK LoadAPIKeyError)
  if (
    status === 401 ||
    status === 403 ||
    err?.name === 'LoadAPIKeyError' ||
    /unauthorized|invalid api key|forbidden|authentication failed/i.test(message)
  ) {
    return new StewardSDKError(
      {
        kind: 'auth',
        message,
        retryable: false,
        statusCode: status,
        provider,
        modelId,
      },
      { cause: error },
    );
  }

  // 3. Rate Limit check (429 or quota exceeded)
  if (status === 429 || /rate limit|too many requests|quota exceeded/i.test(message)) {
    return new StewardSDKError(
      {
        kind: 'rate-limit',
        message,
        retryable: true,
        statusCode: status ?? 429,
        retryAfterMs,
        provider,
        modelId,
      },
      { cause: error },
    );
  }

  // 4. Context Length / Prompt Too Long check
  if (
    status === 413 ||
    err?.name === 'InvalidPromptError' ||
    /context length|maximum context|token limit|prompt too long/i.test(message)
  ) {
    return new StewardSDKError(
      {
        kind: 'context-length',
        message,
        retryable: false,
        statusCode: status,
        provider,
        modelId,
      },
      { cause: error },
    );
  }

  // 5. Network errors (DNS, connection reset, fetch failed)
  if (
    err?.code === 'ECONNRESET' ||
    err?.code === 'ENOTFOUND' ||
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ETIMEDOUT' ||
    /fetch failed|network error|econnreset|enotfound|econnrefused/i.test(message)
  ) {
    return new StewardSDKError(
      {
        kind: 'network',
        message,
        retryable: true,
        statusCode: status,
        provider,
        modelId,
      },
      { cause: error },
    );
  }

  // 6. Invalid Input check
  if (
    (status === 400 &&
      /bad request|invalid parameter|invalid input|invalid request/i.test(message)) ||
    err?.name === 'InvalidArgumentError' ||
    err?.name === 'InvalidDataContentError' ||
    err?.name === 'NoSuchModelError' ||
    err?.name === 'NoSuchProviderError'
  ) {
    return new StewardSDKError(
      {
        kind: 'invalid-input',
        message,
        retryable: false,
        statusCode: status,
        provider,
        modelId,
      },
      { cause: error },
    );
  }

  // 7. Fallback to Provider Default (Catch-All)
  // Transient server errors (500, 502, 503, 504) are marked retryable
  const isServerTransient = status !== undefined && status >= 500 && status <= 504;

  return new StewardSDKError(
    {
      kind: 'provider',
      message,
      retryable: isServerTransient,
      statusCode: status,
      retryAfterMs,
      provider,
      modelId,
    },
    { cause: error },
  );
}
