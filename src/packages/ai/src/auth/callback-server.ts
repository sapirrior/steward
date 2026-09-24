/**
 * @steward/ai - Provider-aware Loopback OAuth Callback Server
 */

import * as http from 'node:http';
import { AIError } from '../errors.js';

export interface OAuthCallbackServerOptions {
  host: '127.0.0.1' | 'localhost';
  port: number;
  path: string;
  expectedState?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface OAuthCallbackResult {
  code: string;
  state?: string;
}

export interface OAuthCallbackServer {
  readonly redirectUri: string;
  wait(): Promise<OAuthCallbackResult>;
  cancel(): void;
  close(): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

export async function startOAuthCallbackServer(
  options: OAuthCallbackServerOptions,
): Promise<OAuthCallbackServer> {
  const {
    host,
    port,
    path: expectedPath,
    expectedState,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const normalizedPath = expectedPath.startsWith('/') ? expectedPath : `/${expectedPath}`;
  const redirectUri = `http://${host}:${port}${normalizedPath}`;

  let server: http.Server | null = null;
  let settled = false;
  let resolvePromise: (value: OAuthCallbackResult) => void;
  let rejectPromise: (reason: Error) => void;
  let abortHandler: (() => void) | undefined;

  const promise = new Promise<OAuthCallbackResult>((res, rej) => {
    resolvePromise = res;
    rejectPromise = rej;
  });

  const closeServer = async (): Promise<void> => {
    if (server) {
      const s = server;
      server = null;
      await new Promise<void>((res) => {
        try {
          s.close(() => res());
        } catch {
          res();
        }
      });
    }
  };

  const finish = async (result?: OAuthCallbackResult, error?: Error): Promise<void> => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);

    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }

    await closeServer();

    if (error) {
      rejectPromise(error);
    } else if (result) {
      resolvePromise(result);
    }
  };

  const timer = setTimeout(() => {
    finish(
      undefined,
      new AIError('OAuth login timed out waiting for callback.', { code: 'oauth' }),
    );
  }, timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new AIError('OAuth login was cancelled.', { code: 'aborted' });
    }
    abortHandler = () => {
      finish(undefined, new AIError('OAuth login was cancelled.', { code: 'aborted' }));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
  }

  server = http.createServer((req, res) => {
    try {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
      }

      const reqUrl = new URL(req.url ?? '/', `http://${host}:${port}`);
      if (reqUrl.pathname !== normalizedPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const error = reqUrl.searchParams.get('error');
      const errorDescription = reqUrl.searchParams.get('error_description');
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<html><body style="font-family: sans-serif; padding: 2rem; text-align: center;"><h2>Authentication Failed</h2><p>You can close this tab and return to your terminal.</p></body></html>',
        );
        finish(
          undefined,
          new AIError(`OAuth authorization error: ${errorDescription || error}`, { code: 'oauth' }),
        );
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const state = reqUrl.searchParams.get('state') ?? undefined;

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing authorization code');
        finish(undefined, new AIError('OAuth callback received without code.', { code: 'oauth' }));
        return;
      }

      if (expectedState && state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid OAuth state parameter');
        finish(
          undefined,
          new AIError('OAuth state validation failed (possible CSRF or stale request).', {
            code: 'oauth',
          }),
        );
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<html><body style="font-family: sans-serif; padding: 2rem; text-align: center;"><h2>Authentication Successful</h2><p>You can close this tab and return to Steward.</p></body></html>',
      );

      finish({ code, state });
    } catch (err) {
      finish(
        undefined,
        new AIError(
          `Error handling OAuth callback: ${err instanceof Error ? err.message : String(err)}`,
          {
            code: 'oauth',
            cause: err,
          },
        ),
      );
    }
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server!.on('error', async (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
        await closeServer();
        if (err.code === 'EADDRINUSE') {
          reject(
            new AIError(`Port ${port} is already in use. Cannot start OAuth callback server.`, {
              code: 'oauth',
              cause: err,
            }),
          );
        } else {
          reject(
            new AIError(`Failed to bind OAuth callback server: ${err.message}`, {
              code: 'oauth',
              cause: err,
            }),
          );
        }
      });

      server!.listen(port, host, () => {
        resolve();
      });
    });
  } catch (listenErr) {
    await closeServer();
    throw listenErr;
  }

  return {
    redirectUri,
    wait: () => promise,
    cancel: () => {
      finish(undefined, new AIError('OAuth callback cancelled.', { code: 'aborted' }));
    },
    close: async () => {
      await finish(undefined, new AIError('OAuth callback server closed.', { code: 'aborted' }));
    },
  };
}
