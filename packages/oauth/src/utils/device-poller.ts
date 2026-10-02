import { OAuthError } from '../errors.js';

export interface DeviceCodePollOptions<T> {
  providerName: string;
  intervalSeconds?: number;
  expiresInSeconds?: number;
  waitBeforeFirstPoll?: boolean;
  poll: () => Promise<
    | { status: 'pending' }
    | { status: 'slow_down'; intervalSeconds?: number }
    | { status: 'failed'; message: string }
    | { status: 'complete'; value: T }
  >;
  signal?: AbortSignal;
}

const MINIMUM_INTERVAL_MS = 1000;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const SLOW_DOWN_INCREMENT_MS = 5000;

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new OAuthError('Login cancelled', 'aborted'));
      return;
    }

    let timeout: NodeJS.Timeout | undefined;
    const onAbort = () => {
      if (timeout) clearTimeout(timeout);
      reject(new OAuthError('Login cancelled', 'aborted'));
    };

    timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollOAuthDeviceCodeFlow<T>(options: DeviceCodePollOptions<T>): Promise<T> {
  const { providerName, signal } = options;
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
      await abortableSleep(Math.min(intervalMs, remaining), signal);
    }
  }

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new OAuthError('Login cancelled', 'aborted', providerName);
    }

    const result = await options.poll();

    if (result.status === 'complete') {
      return result.value;
    }

    if (result.status === 'failed') {
      throw new OAuthError(result.message, 'oauth', providerName);
    }

    if (result.status === 'slow_down') {
      intervalMs =
        typeof result.intervalSeconds === 'number' && result.intervalSeconds > 0
          ? Math.max(MINIMUM_INTERVAL_MS, Math.floor(result.intervalSeconds * 1000))
          : Math.max(MINIMUM_INTERVAL_MS, intervalMs + SLOW_DOWN_INCREMENT_MS);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    await abortableSleep(Math.min(intervalMs, remaining), signal);
  }

  throw new OAuthError('Device authorization flow timed out.', 'timeout', providerName);
}
