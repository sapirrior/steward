/**
 * @steward/ai - Provider-aware Loopback OAuth Callback Server
 */

import { createServer, type ServerResponse } from 'node:http';
import { AIError } from '../errors.js';
import type { AuthInteraction } from './types.js';

export interface OAuthCallbackServerOptions<T = string> {
  providerName: string;
  host: string;
  port: number;
  path: string;
  expectedState?: string;
  /**
   * Finishes sign-in with the received code BEFORE the browser page is sent,
   * so the browser page can show exchange failures.
   */
  complete?: (code: string) => Promise<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface OAuthCallbackServer<T = string> {
  readonly redirectUri: string;
  wait(): Promise<T | undefined>;
  cancel(): void;
  close(): void;
}

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPage(options: { title: string; heading: string; message: string; details?: string }): string {
  const title = escapeHtml(options.title);
  const heading = escapeHtml(options.heading);
  const message = escapeHtml(options.message);
  const details = options.details ? escapeHtml(options.details) : undefined;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --text: #f8fafc;
      --text-dim: #94a3b8;
      --page-bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --accent: #38bdf8;
      --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    html { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--page-bg);
      color: var(--text);
      font-family: var(--font-sans);
      text-align: center;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1rem;
      padding: 2.5rem 2rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 24px;
      font-weight: 600;
      color: var(--accent);
    }
    p {
      margin: 0;
      line-height: 1.6;
      color: var(--text-dim);
      font-size: 15px;
    }
    .details {
      margin-top: 16px;
      font-family: var(--font-mono);
      font-size: 13px;
      color: #f87171;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 0.5rem;
      padding: 0.75rem;
      text-align: left;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${options.details ? '❌' : '✨'}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    ${details ? `<div class="details">${details}</div>` : ''}
  </div>
</body>
</html>`;
}

function sendPage(response: ServerResponse, status: number, html: string): void {
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  response.end(html);
}

export async function startOAuthCallbackServer<T = string>(
  options: OAuthCallbackServerOptions<T>,
): Promise<OAuthCallbackServer<T>> {
  const { providerName, host, port, path: expectedPath, expectedState, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (signal?.aborted) throw new AIError('Login cancelled', { code: 'aborted' });

  const normalizedPath = expectedPath.startsWith('/') ? expectedPath : `/${expectedPath}`;

  let resolveWait: (value: T | undefined) => void = () => {};
  let rejectWait: (error: Error) => void = () => {};
  const waitPromise = new Promise<T | undefined>((resolve, reject) => {
    resolveWait = resolve;
    rejectWait = reject;
  });
  waitPromise.catch(() => undefined);

  let claimed = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onAbort = () => finish({ error: new AIError('Login cancelled', { code: 'aborted' }) });
  const finish = (result: { value: T | undefined } | { error: Error }): void => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    if ('error' in result) rejectWait(result.error);
    else resolveWait(result.value);
  };

  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method !== 'GET' || url.pathname !== normalizedPath) {
        sendPage(
          response,
          404,
          renderPage({
            title: 'Route Not Found',
            heading: 'Callback Route Not Found',
            message: 'This callback path is invalid.',
          }),
        );
        return;
      }

      if (expectedState !== undefined && url.searchParams.get('state') !== expectedState) {
        sendPage(
          response,
          400,
          renderPage({
            title: 'State Mismatch',
            heading: 'Security Validation Failed',
            message: 'OAuth state parameter did not match.',
          }),
        );
        return;
      }

      if (claimed || settled) {
        sendPage(
          response,
          409,
          renderPage({
            title: 'Already Processed',
            heading: 'Sign-in Handled',
            message: 'This authentication request has already been completed. You may close this window.',
          }),
        );
        return;
      }

      const error = url.searchParams.get('error');
      if (error) {
        const description = url.searchParams.get('error_description') ?? error;
        sendPage(
          response,
          400,
          renderPage({
            title: `${providerName} authorization failed`,
            heading: 'Authorization Failed',
            message: `${providerName} authorization request was denied.`,
            details: description,
          }),
        );
        finish({ error: new AIError(`${providerName} authorization failed: ${description}`, { code: 'oauth' }) });
        return;
      }

      const code = url.searchParams.get('code');
      if (!code) {
        sendPage(
          response,
          400,
          renderPage({
            title: 'Missing Code',
            heading: 'Missing Authorization Code',
            message: 'No authorization code found in callback query parameters.',
          }),
        );
        return;
      }

      claimed = true;
      try {
        let value: T;
        if (options.complete) {
          value = await options.complete(code);
        } else {
          value = code as unknown as T;
        }

        sendPage(
          response,
          200,
          renderPage({
            title: 'Authentication Successful',
            heading: 'Authentication Successful',
            message: `Signed in to ${providerName}. You may now close this tab and return to your terminal.`,
          }),
        );
        finish({ value });
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        sendPage(
          response,
          502,
          renderPage({
            title: `${providerName} sign-in failed`,
            heading: 'Sign-in Failed',
            message: 'Failed to exchange authorization code for an access token.',
            details: failure.message,
          }),
        );
        finish({ error: failure });
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new AIError('OAuth callback server did not bind to TCP', { code: 'oauth' });
  }

  server.on('error', (error) => finish({ error }));
  signal?.addEventListener('abort', onAbort, { once: true });
  if (timeoutMs !== undefined) {
    timer = setTimeout(() => finish({ error: new AIError(`${providerName} sign-in timed out`, { code: 'oauth' }) }), timeoutMs);
  }

  const redirectUri = `http://${host}:${address.port}${normalizedPath}`;

  return {
    redirectUri,
    wait: () => waitPromise,
    cancel: () => {
      if (!claimed) finish({ value: undefined });
    },
    close: () => {
      finish({ error: new AIError('OAuth callback server closed', { code: 'aborted' }) });
      server.close();
    },
  };
}

/**
 * Wait for browser callback or manual pasted code/redirect URL.
 */
export async function waitForCallbackOrManualInput<T>(
  interaction: AuthInteraction,
  callback: OAuthCallbackServer<T> | undefined,
  prompt: { message: string; placeholder?: string },
): Promise<{ type: 'callback'; value: T } | { type: 'manual'; input: string }> {
  const manualAbort = new AbortController();
  let manualError: Error | undefined;

  const manual = interaction
    .prompt({
      type: 'manual-code',
      message: prompt.message,
      placeholder: prompt.placeholder,
      signal: manualAbort.signal,
    })
    .then((input) => {
      if (input && input.trim()) {
        callback?.cancel();
        return input.trim();
      }
      return undefined;
    })
    .catch((error: unknown) => {
      manualError = error instanceof Error ? error : new Error(String(error));
      callback?.cancel();
      return undefined;
    });

  try {
    const value = await callback?.wait();
    if (manualError) throw manualError;
    if (value !== undefined) return { type: 'callback', value };
    const input = await manual;
    if (manualError) throw manualError;
    return { type: 'manual', input: input ?? '' };
  } finally {
    manualAbort.abort();
  }
}
