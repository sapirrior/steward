import { generatePKCE } from '../utils/pkce.js';
import { startOAuthCallbackServer } from '../utils/callback-server.js';
import { launchBrowser } from '../utils/browser.js';
import { OAuthError } from '../errors.js';
import type { LoginOptions, TokenRecord } from '../types.js';

const CLIENT_ID = atob('OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl');
const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CALLBACK_HOST = 'localhost';
const CALLBACK_PORT = 53692;
const CALLBACK_PATH = '/callback';
const REDIRECT_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;
const SCOPES =
  'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload';

async function exchangeAuthorizationCode(
  code: string,
  state: string,
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
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      state,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
    signal,
  });

  if (!response.ok) {
    throw new OAuthError(
      `Anthropic OAuth token exchange failed (HTTP ${response.status})`,
      'oauth',
      'anthropic',
    );
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    account?: { email?: string };
  };

  const expiresAt = tokenData.expires_in
    ? Date.now() + tokenData.expires_in * 1000
    : undefined;

  return {
    type: 'oauth',
    access: tokenData.access_token,
    refresh: tokenData.refresh_token,
    expires: expiresAt,
    account: tokenData.account?.email,
  };
}

export async function loginAnthropic(options?: LoginOptions): Promise<TokenRecord> {
  const { verifier, challenge } = await generatePKCE();
  const server = await startOAuthCallbackServer<TokenRecord>({
    providerName: 'Anthropic',
    host: 'localhost',
    port: CALLBACK_PORT,
    path: CALLBACK_PATH,
    expectedState: verifier,
    signal: options?.signal,
    complete: (code) => exchangeAuthorizationCode(code, verifier, verifier, options?.signal),
  });

  try {
    const authParams = new URLSearchParams({
      code: 'true',
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: verifier,
    });

    const fullAuthUrl = `${AUTHORIZE_URL}?${authParams.toString()}`;

    if (options?.onAuthUrl) {
      options.onAuthUrl(fullAuthUrl);
    }
    await launchBrowser(fullAuthUrl);

    const token = await server.wait();
    if (!token) {
      throw new OAuthError('Anthropic OAuth login was cancelled or failed to complete', 'cancelled', 'anthropic');
    }
    return token;
  } finally {
    server.close();
  }
}

export async function refreshAnthropic(
  token: TokenRecord,
  signal?: AbortSignal,
): Promise<TokenRecord> {
  if (!token.refresh) {
    throw new OAuthError(
      'Cannot refresh Anthropic OAuth token: no refresh token stored',
      'oauth',
      'anthropic',
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: token.refresh,
    }),
    signal,
  });

  if (!response.ok) {
    const err: any = new OAuthError(
      `Anthropic OAuth token refresh failed (HTTP ${response.status})`,
      'oauth',
      'anthropic',
    );
    err.status = response.status;
    throw err;
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = tokenData.expires_in
    ? Date.now() + tokenData.expires_in * 1000
    : undefined;

  return {
    ...token,
    access: tokenData.access_token,
    refresh: tokenData.refresh_token ?? token.refresh,
    expires: expiresAt,
  };
}
