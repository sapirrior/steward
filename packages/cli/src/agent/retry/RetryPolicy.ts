export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterFactor: number;
}

export const DEFAULT_RETRY_POLICY: Readonly<RetryPolicy> = {
  maxRetries: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2.0,
  jitterFactor: 0.3, // Random timing bump (±30% jitter to prevent thundering herds)
};
