import { describe, it, expect } from 'bun:test';
import { withRetry, type HttpError } from '../src/util/retry.ts';

function makeHttpError(status: number, headers?: Record<string, string>): HttpError {
  const err = Object.assign(new Error(`HTTP ${status}`), {
    status,
    headers: headers ? new Headers(headers) : undefined,
  }) as HttpError;
  return err;
}

describe('util/retry — withRetry', () => {
  it('returns immediately on success without retrying', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries on 429 and eventually succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw makeHttpError(429);
        return 'done';
      },
      { maxRetries: 3, maxRetryDelayMs: 0 },
    );
    expect(result).toBe('done');
    expect(calls).toBe(3);
  });

  it('retries on 500', async () => {
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw makeHttpError(500);
        return 'ok';
      },
      { maxRetries: 2, maxRetryDelayMs: 0 },
    );
    expect(calls).toBe(2);
  });

  it('retries on 408', async () => {
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw makeHttpError(408);
        return 'ok';
      },
      { maxRetries: 2, maxRetryDelayMs: 0 },
    );
    expect(calls).toBe(2);
  });

  it('does NOT retry on 400', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw makeHttpError(400);
        },
        { maxRetries: 2, maxRetryDelayMs: 0 },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it('exhausts retries and re-throws', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw makeHttpError(429);
        },
        { maxRetries: 2, maxRetryDelayMs: 0 },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(3); // initial + 2 retries
  });

  it('honours Retry-After-Ms header', async () => {
    let calls = 0;
    const start = Date.now();
    const result = await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw makeHttpError(429, { 'retry-after-ms': '50' });
        return 'ok';
      },
      { maxRetries: 1, maxRetryDelayMs: 1000 },
    );
    expect(result).toBe('ok');
    expect(Date.now() - start).toBeGreaterThanOrEqual(40); // waited ~50ms
  });

  it('throws when Retry-After exceeds maxRetryDelayMs', async () => {
    await expect(
      withRetry(
        async () => {
          throw makeHttpError(429, { 'retry-after-ms': '90000' });
        },
        { maxRetries: 1, maxRetryDelayMs: 60_000 },
      ),
    ).rejects.toThrow(/retry delay/);
  });

  it('aborts mid-backoff when signal fires', async () => {
    const controller = new AbortController();
    let calls = 0;
    setTimeout(() => controller.abort(), 20);

    await expect(
      withRetry(
        async () => {
          calls++;
          throw makeHttpError(429, { 'retry-after-ms': '500' });
        },
        { maxRetries: 3, signal: controller.signal, maxRetryDelayMs: 10_000 },
      ),
    ).rejects.toThrow(/aborted/i);

    expect(calls).toBeLessThanOrEqual(2);
  });

  it('notifies onRetry callback with attempt, maxAttempts, and delay details', async () => {
    let calls = 0;
    const retryEvents: any[] = [];

    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw makeHttpError(503);
        return 'success';
      },
      {
        maxRetries: 5,
        maxDelayMs: 0,
        onRetry: (info) => {
          retryEvents.push(info);
        },
      },
    );

    expect(result).toBe('success');
    expect(calls).toBe(3);
    expect(retryEvents.length).toBe(2);
    expect(retryEvents[0].attempt).toBe(1);
    expect(retryEvents[0].maxAttempts).toBe(6);
    expect(retryEvents[1].attempt).toBe(2);
  });
});
