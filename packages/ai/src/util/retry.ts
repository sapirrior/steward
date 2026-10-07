/**
 * @steward/ai - Provider request retry with exponential/polynomial backoff and timeout
 *
 * Retries on:
 * - Network errors (fetch failed, ECONNREFUSED, timeout)
 * - HTTP 408, 409, 429, 500, 502, 503, 504, 529
 *
 * Honors Retry-After / retry-after-ms headers, capped at maxDelayMs.
 * Default: 10 max retries, 1.5x multiplier, starting at 500ms with jitter.
 * Per-attempt timeout using chained AbortSignal.
 * Fires onRetry callback before backoff sleep.
 */

export interface RetryPolicy {
  maxRetries?: number;
  baseDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  maxRetryDelayMs?: number;
  timeoutMs?: number;
  onRetry?: (info: { attempt: number; maxAttempts: number; delayMs: number; error: Error }) => void;
}

export interface RetryOptions extends RetryPolicy {
  signal?: AbortSignal;
}

const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_BACKOFF_MULTIPLIER = 1.5;
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 45_000;

export function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529
  );
}

export class AbortError extends Error {
  constructor(message = 'Request aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
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

export function getRetryDelayMs(
  headers: Headers | undefined,
  retryIndex: number,
  baseDelayMs: number,
  backoffMultiplier: number,
  maxDelayMs: number,
  errorMessage: string,
): number {
  if (headers) {
    const afterMs = headers.get('retry-after-ms');
    if (afterMs) {
      const v = Number.parseFloat(afterMs);
      if (!Number.isNaN(v)) return capDelay(v, maxDelayMs, errorMessage);
    }
    const after = headers.get('retry-after');
    if (after) {
      const seconds = Number.parseFloat(after);
      const ms = Number.isNaN(seconds) ? Date.parse(after) - Date.now() : seconds * 1000;
      return capDelay(ms, maxDelayMs, errorMessage);
    }
  }

  // Exponential/multiplier backoff with ±15% jitter: base * multiplier^retryIndex
  const calculated = baseDelayMs * backoffMultiplier ** retryIndex;
  const clamped = Math.min(calculated, maxDelayMs);
  const jitter = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
  return Math.min(Math.round(clamped * jitter), maxDelayMs);
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
  /** Perform the request with per-attempt abort signal. */
  (signal?: AbortSignal): Promise<T>;
}

export interface HttpError extends Error {
  status: number;
  headers?: Headers;
}

export function isHttpError(e: unknown): e is HttpError {
  return e instanceof Error && typeof (e as HttpError).status === 'number';
}

/**
 * Wraps a request with per-attempt timeout, retry, backoff, and event notification.
 */
export async function withRetry<T>(
  request: RetryableRequest<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const backoffMultiplier = options.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let retriesLeft = maxRetries;

  for (let attempt = 1; ; attempt++) {
    // Setup per-attempt timeout abort controller chained to parent signal
    const attemptController = new AbortController();
    let timeoutTimer: any = null;

    const onParentAbort = () => {
      attemptController.abort(new AbortError());
    };

    if (options.signal) {
      if (options.signal.aborted) {
        throw new AbortError();
      }
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }

    if (timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        attemptController.abort(new TimeoutError(timeoutMs));
      }, timeoutMs);
    }

    try {
      return await request(attemptController.signal);
    } catch (err) {
      if (options.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new AbortError();
      }

      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      const isNetwork = !(err instanceof Error) || !isHttpError(err);
      const retryable = isTimeout || isNetwork || isRetryableStatus((err as HttpError).status);

      if (retriesLeft <= 0 || !retryable) {
        throw err;
      }

      const retryIndex = maxRetries - retriesLeft;
      retriesLeft--;

      const headers = isHttpError(err) ? (err as HttpError).headers : undefined;
      const delayMs = getRetryDelayMs(
        headers,
        retryIndex,
        baseDelayMs,
        backoffMultiplier,
        maxDelayMs,
        err instanceof Error ? err.message : String(err),
      );

      options.onRetry?.({
        attempt,
        maxAttempts: maxRetries + 1,
        delayMs,
        error: err instanceof Error ? err : new Error(String(err)),
      });

      await abortableSleep(delayMs, options.signal);
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (options.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }
    }
  }
}
