/**
 * @steward/ai - RFC 8628 OAuth 2.0 Device Authorization Poller
 */

export interface DeviceCodePollOptions<T> {
  intervalSeconds?: number;
  expiresInSeconds?: number;
  waitBeforeFirstPoll?: boolean;
  poll: () => Promise<
    | { status: 'pending' }
    | { status: 'slow_down'; intervalSeconds?: number }
    | { status: 'failed'; message: string }
    | { status: 'complete'; value: T }
  >;
  signal: AbortSignal;
}

const MINIMUM_INTERVAL_MS = 1000;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const SLOW_DOWN_INCREMENT_MS = 5000;

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Login cancelled'));
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error('Login cancelled'));
    };

    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollOAuthDeviceCodeFlow<T>(options: DeviceCodePollOptions<T>): Promise<T> {
  const deadline =
    typeof options.expiresInSeconds === 'number'
      ? Date.now() + options.expiresInSeconds * 1000
      : Number.POSITIVE_INFINITY;

  let intervalMs = Math.max(
    MINIMUM_INTERVAL_MS,
    Math.floor((options.intervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS) * 1000),
  );

  if (options.waitBeforeFirstPoll) {
    const remaining = deadline - Date.now();
    if (remaining > 0) {
      await abortableSleep(Math.min(intervalMs, remaining), options.signal);
    }
  }

  while (Date.now() < deadline) {
    if (options.signal.aborted) {
      throw new Error('Login cancelled');
    }

    const result = await options.poll();

    if (result.status === 'complete') {
      return result.value;
    }

    if (result.status === 'failed') {
      throw new Error(result.message);
    }

    if (result.status === 'slow_down') {
      intervalMs =
        typeof result.intervalSeconds === 'number' && result.intervalSeconds > 0
          ? Math.max(MINIMUM_INTERVAL_MS, Math.floor(result.intervalSeconds * 1000))
          : Math.max(MINIMUM_INTERVAL_MS, intervalMs + SLOW_DOWN_INCREMENT_MS);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    await abortableSleep(Math.min(intervalMs, remaining), options.signal);
  }

  throw new Error('Device authorization flow timed out.');
}
