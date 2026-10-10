import type { RetryPolicy } from './RetryPolicy.js';
import { DEFAULT_RETRY_POLICY } from './RetryPolicy.js';
import { normalizeAgentError } from '../errors/errorNormalizer.js';
import { AgentError } from '../errors/AgentError.js';
import type { AgentRetryEvent, RetryConfig } from '../types.js';
import type { ModelRef } from '@steward/models';

export interface ExecuteWithRetryOptions<T> {
  fn: (attempt: number) => Promise<T>;
  policy?: RetryConfig;
  modelRef?: ModelRef | string;
  signal?: AbortSignal;
  onRetry?: (event: AgentRetryEvent) => void;
}

/**
 * Calculates exponential backoff delay with random timing bump (jitter).
 */
export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy,
  explicitRetryAfterMs?: number,
): number {
  if (explicitRetryAfterMs !== undefined && explicitRetryAfterMs >= 0) {
    return explicitRetryAfterMs;
  }

  const baseDelay = Math.min(
    policy.maxDelayMs,
    policy.initialDelayMs * Math.pow(policy.backoffFactor, Math.max(0, attempt - 1)),
  );

  // Random timing bump: ±(jitterFactor * 100)%
  const randomBump = (Math.random() * 2 - 1) * policy.jitterFactor;
  const computedDelay = Math.round(baseDelay * (1 + randomBump));

  return Math.max(50, Math.min(policy.maxDelayMs, computedDelay));
}

/**
 * Sleep helper respecting AbortSignal.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(
        new AgentError({
          code: 'ABORTED',
          message: 'Operation canceled by user during retry wait.',
          retryable: false,
        }),
      );
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(
        new AgentError({
          code: 'ABORTED',
          message: 'Operation canceled by user during retry wait.',
          retryable: false,
        }),
      );
    };

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Executes an async operation with automatic exponential backoff retry and typed retry events.
 */
export async function executeWithRetry<T>(options: ExecuteWithRetryOptions<T>): Promise<T> {
  const policy: RetryPolicy = {
    ...DEFAULT_RETRY_POLICY,
    ...options.policy,
  };

  let attempt = 1;

  while (true) {
    if (options.signal?.aborted) {
      throw new AgentError({
        code: 'ABORTED',
        message: 'Operation canceled by user.',
        retryable: false,
      });
    }

    try {
      return await options.fn(attempt);
    } catch (rawErr: unknown) {
      const normalized = normalizeAgentError(rawErr, {
        modelRef: options.modelRef,
        signal: options.signal,
      });

      // If error is not retryable or maxRetries reached or aborted, stop and throw
      if (!normalized.retryable || attempt >= policy.maxRetries || options.signal?.aborted) {
        throw normalized;
      }

      const delayMs = calculateRetryDelay(attempt, policy, normalized.retryAfterMs);

      // Emit distinct retry event with delayMs and reason
      options.onRetry?.({
        type: 'retry',
        attempt,
        maxRetries: policy.maxRetries,
        delayMs,
        error: normalized,
      });

      await sleep(delayMs, options.signal);
      attempt++;
    }
  }
}
