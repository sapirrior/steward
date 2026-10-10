import { describe, it, expect, mock } from 'bun:test';
import { executeWithRetry, calculateRetryDelay } from './index.js';
import { AgentError } from '../errors/index.js';
import type { AgentRetryEvent } from '../types.js';

describe('RetryEngine and calculateRetryDelay', () => {
  it('calculates delay with exponential backoff and random bump within bounds', () => {
    const policy = {
      maxRetries: 10,
      initialDelayMs: 100,
      maxDelayMs: 2000,
      backoffFactor: 2.0,
      jitterFactor: 0.3,
    };

    // Attempt 1: ~100ms ± 30%
    const delay1 = calculateRetryDelay(1, policy);
    expect(delay1).toBeGreaterThanOrEqual(70);
    expect(delay1).toBeLessThanOrEqual(130);

    // Attempt 2: ~200ms ± 30%
    const delay2 = calculateRetryDelay(2, policy);
    expect(delay2).toBeGreaterThanOrEqual(140);
    expect(delay2).toBeLessThanOrEqual(260);

    // Explicit retryAfterMs takes precedence
    const explicitDelay = calculateRetryDelay(1, policy, 4500);
    expect(explicitDelay).toBe(4500);
  });

  it('succeeds on first attempt without triggering retries', async () => {
    const fn = mock(async (attempt: number) => `result-${attempt}`);
    const onRetry = mock((_e: AgentRetryEvent) => {});

    const result = await executeWithRetry({ fn, onRetry });
    expect(result).toBe('result-1');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(0);
  });

  it('retries transient errors and emits retry events with random timing bump', async () => {
    let callCount = 0;
    const retryEvents: AgentRetryEvent[] = [];

    const fn = async (attempt: number) => {
      callCount++;
      if (callCount < 3) {
        throw new AgentError({
          code: 'RATE_LIMITED',
          message: 'Rate limited',
          retryable: true,
        });
      }
      return `recovered-on-${attempt}`;
    };

    const result = await executeWithRetry({
      fn,
      policy: {
        maxRetries: 10,
        initialDelayMs: 10,
        maxDelayMs: 50,
        backoffFactor: 1.5,
        jitterFactor: 0.2,
      },
      onRetry: (event) => {
        retryEvents.push(event);
      },
    });

    expect(result).toBe('recovered-on-3');
    expect(callCount).toBe(3);
    expect(retryEvents.length).toBe(2);
    expect(retryEvents[0].attempt).toBe(1);
    expect(retryEvents[0].maxRetries).toBe(10);
    expect(retryEvents[0].error.code).toBe('RATE_LIMITED');
    expect(retryEvents[1].attempt).toBe(2);
  });

  it('stops immediately and throws on non-retryable error (e.g. AUTH_INVALID)', async () => {
    const fn = async () => {
      throw new AgentError({
        code: 'AUTH_INVALID',
        message: 'Invalid key',
        retryable: false,
      });
    };

    const onRetry = mock((_e: AgentRetryEvent) => {});

    await expect(
      executeWithRetry({
        fn,
        onRetry,
        policy: {
          maxRetries: 10,
          initialDelayMs: 10,
          maxDelayMs: 50,
          backoffFactor: 2,
          jitterFactor: 0.2,
        },
      }),
    ).rejects.toThrow();

    expect(onRetry).toHaveBeenCalledTimes(0);
  });

  it('aborts when signal is triggered during retry wait', async () => {
    const controller = new AbortController();
    let callCount = 0;

    const fn = async () => {
      callCount++;
      // Trigger abort immediately after first failure
      controller.abort();
      throw new AgentError({
        code: 'SERVER_OVERLOADED',
        message: 'Server 503',
        retryable: true,
      });
    };

    await expect(
      executeWithRetry({
        fn,
        signal: controller.signal,
        policy: {
          maxRetries: 10,
          initialDelayMs: 500,
          maxDelayMs: 2000,
          backoffFactor: 2,
          jitterFactor: 0.2,
        },
      }),
    ).rejects.toThrow();

    expect(callCount).toBe(1);
  });
});
