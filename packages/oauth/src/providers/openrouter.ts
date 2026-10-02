import { randomUUID } from 'node:crypto';
import { generatePKCE } from '../utils/pkce.js';
import { startOAuthCallbackServer } from '../utils/callback-server.js';
import { launchBrowser } from '../utils/browser.js';
import { OAuthError } from '../errors.js';
import type { LoginOptions, TokenRecord } from '../types.js';

const AUTHORIZE_URL = 'https://openrouter.ai/auth';
const TOKEN_URL = 'https://openrouter.ai/api/v1/auth/keys';
const CALLBACK_HOST = '127.0.0.1';

async function exchangeAuthorizationCode(
  code: string,
  verifier: string,
  signal?: AbortSignal,
): Promise<TokenRecord> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      code_challenge_method: 'S256',
    }),
    signal,
  });

  if (!response.ok) {
    throw new OAuthError(
      `OpenRouter OAuth key exchange failed (HTTP ${response.status})`,
      'oauth',
      'openrouter',
    );
  }

  const body = (await response.json()) as { key?: string; user?: { email?: string } };
  if (!body.key || typeof body.key !== 'string') {
    throw new OAuthError(
      'OpenRouter OAuth response did not contain an API key',
      'oauth',
      'openrouter',
    );
  }

  return {
    type: 'oauth',
    access: body.key,
    account: body.user?.email,
  };
}

export async function loginOpenRouter(options?: LoginOptions): Promise<TokenRecord> {
  const { verifier, challenge } = await generatePKCE();
  const callbackPath = `/oauth/callback/${randomUUID()}`;

  const server = await startOAuthCallbackServer<TokenRecord>({
    providerName: 'OpenRouter',
    host: CALLBACK_HOST,
    port: 0, // dynamic port assignment
    path: callbackPath,
    signal: options?.signal,
    complete: (code) => exchangeAuthorizationCode(code, verifier, options?.signal),
  });

  try {
    const authorizeUrl = new URL(AUTHORIZE_URL);
    authorizeUrl.search = new URLSearchParams({
      callback_url: server.redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    const authUrlStr = authorizeUrl.toString();
    if (options?.onAuthUrl) {
      options.onAuthUrl(authUrlStr);
    }
    await launchBrowser(authUrlStr);

    const token = await server.wait();
    if (!token) {
      throw new OAuthError(
        'OpenRouter OAuth login was cancelled or failed to complete',
        'cancelled',
        'openrouter',
      );
    }
    return token;
  } finally {
    server.close();
  }
}

export async function refreshOpenRouter(
  token: TokenRecord,
  _signal?: AbortSignal,
): Promise<TokenRecord> {
  // OpenRouter tokens are permanent API keys; no expiration refresh required
  return token;
}
