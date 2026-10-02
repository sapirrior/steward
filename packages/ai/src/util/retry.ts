/**
 * @steward/ai - Provider request retry with exponential backoff
 *
 * Retries ONLY before the first stream byte, on:
 * - Network errors (no status)
 * - HTTP 408, 409, 429, 5xx
 *
 * Honours Retry-After / retry-after-ms headers, capped at maxRetryDelayMs.
 * Sleep is abortable — AbortSignal cancels mid-backoff.
 * Default: maxRetries=2, maxRetryDelayMs=60_000.
 */

export interface RetryOptions {
  maxRetries?: number;
  maxRetryDelayMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(t);
      reject(new AbortError());
    };
    const t = setTimeout(
      () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      },
      Math.max(0, ms),
    );
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

class AbortError extends Error {
  constructor() {
    super('Request aborted');
    this.name = 'AbortError';
  }
}

function getRetryDelayMs(
  headers: Headers | undefined,
  retryIndex: number,
  maxRetryDelayMs: number,
  errorMessage: string,
): number {
  if (headers) {
    const afterMs = headers.get('retry-after-ms');
    if (afterMs) {
      const v = Number.parseFloat(afterMs);
      if (!Number.isNaN(v)) return capDelay(v, maxRetryDelayMs, errorMessage);
    }
    const after = headers.get('retry-after');
    if (after) {
      const seconds = Number.parseFloat(after);
      const ms = Number.isNaN(seconds) ? Date.parse(after) - Date.now() : seconds * 1000;
      return capDelay(ms, maxRetryDelayMs, errorMessage);
    }
  }
  // Exponential backoff with 25% jitter: 0.5s, 1s, 2s, 4s … capped at 8s base
  const base = Math.min(0.5 * 2 ** retryIndex, 8) * 1000;
  return base * (1 - Math.random() * 0.25);
}

function capDelay(ms: number, max: number, msg: string): number {
  if (max > 0 && ms > max) {
    throw new Error(
      `Server requested ${Math.ceil(ms / 1000)}s retry delay (max: ${Math.ceil(max / 1000)}s). ${msg}`,
    );
  }
  return ms;
}

export interface RetryableRequest<T> {
  /** Perform the request. Throw with `.status` number and optional `.headers` on HTTP errors. */
  (): Promise<T>;
}

export interface HttpError extends Error {
  status: number;
  headers?: Headers;
}

function isHttpError(e: unknown): e is HttpError {
  return e instanceof Error && typeof (e as HttpError).status === 'number';
}

/**
 * Wraps a raw-fetch request with retry/backoff logic.
 * The request function should throw an HttpError on non-2xx responses
 * (with `.status` and optionally `.headers` set).
 */
export async function withRetry<T>(
  request: RetryableRequest<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  let retriesLeft = maxRetries;

  for (;;) {
    try {
      return await request();
    } catch (err) {
      if (options.signal?.aborted || err instanceof AbortError) throw new AbortError();

      const isNetwork = !(err instanceof Error) || !isHttpError(err);
      const retryable = isNetwork || isRetryableStatus((err as HttpError).status);

      if (retriesLeft <= 0 || !retryable) throw err;

      const retryIndex = maxRetries - retriesLeft;
      retriesLeft--;

      const headers = isHttpError(err) ? (err as HttpError).headers : undefined;
      const delayMs = getRetryDelayMs(headers, retryIndex, maxRetryDelayMs, (err as Error).message);
      await abortableSleep(delayMs, options.signal);
    }
  }
}
