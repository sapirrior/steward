/**
 * @steward/ai - Anthropic OAuth Adapter
 */

import { generatePKCE } from '../pkce.js';
import { startOAuthCallbackServer } from '../callback-server.js';
import type { AuthInteraction, OAuthCredential, ResolvedAuth } from '../types.js';
import { AIError } from '../../errors.js';

const CLIENT_ID = atob('OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl');
const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CALLBACK_HOST = 'localhost';
const CALLBACK_PORT = 53692;
const CALLBACK_PATH = '/callback';
const REDIRECT_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;
const SCOPES =
  'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload';

function parseAuthorizationInput(input: string): { code?: string; state?: string } {
  const value = input.trim();
  if (!value) return {};

  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get('code') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
    };
  } catch {
    // not a URL
  }

  if (value.includes('#')) {
    const [code, state] = value.split('#', 2);
    return { code, state };
  }

  if (value.includes('code=')) {
    const params = new URLSearchParams(value);
    return {
      code: params.get('code') ?? undefined,
      state: params.get('state') ?? undefined,
    };
  }

  return { code: value };
}

async function exchangeAuthorizationCode(
  code: string,
  state: string,
  verifier: string,
  signal?: AbortSignal,
): Promise<OAuthCredential> {
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
    throw new AIError(`Anthropic OAuth token exchange failed with HTTP status ${response.status}`, {
      code: 'oauth',
      provider: 'anthropic',
      status: response.status,
    });
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    type: 'oauth',
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000 - 5 * 60 * 1000,
  };
}

export async function loginAnthropic(interaction: AuthInteraction): Promise<OAuthCredential> {
  const { verifier, challenge } = await generatePKCE();
  const server = await startOAuthCallbackServer({
    host: 'localhost',
    port: CALLBACK_PORT,
    path: CALLBACK_PATH,
    expectedState: verifier,
    signal: interaction.signal,
  });

  const manualAbort = new AbortController();

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

    interaction.notify({
      type: 'auth-url',
      url: `${AUTHORIZE_URL}?${authParams.toString()}`,
      instructions:
        'Complete login in your browser. If the browser is on another machine, paste the final redirect URL or code here.',
    });

    let manualInput: string | undefined;
    const manualPromise = interaction
      .prompt({
        type: 'manual-code',
        message:
          'Complete login in your browser, or paste the authorization code / redirect URL here:',
        placeholder: REDIRECT_URI,
        signal: manualAbort.signal,
      })
      .then((input) => {
        manualInput = input;
        server.cancel();
      })
      .catch(() => {});

    const waitPromise = server.wait().catch((err) => {
      if (manualInput) return null;
      throw err;
    });

    const result = await Promise.race([waitPromise, manualPromise.then(() => null)]);

    let code: string | undefined;
    let state: string | undefined;

    if (result && result.code) {
      code = result.code;
      state = result.state ?? verifier;
    } else if (manualInput) {
      const parsed = parseAuthorizationInput(manualInput);
      code = parsed.code;
      state = parsed.state ?? verifier;
    }

    if (!code) {
      throw new AIError('Missing authorization code for Anthropic OAuth.', {
        code: 'oauth',
        provider: 'anthropic',
      });
    }

    interaction.notify({
      type: 'progress',
      message: 'Exchanging authorization code for tokens...',
    });

    return await exchangeAuthorizationCode(code, state!, verifier, interaction.signal);
  } finally {
    manualAbort.abort();
    await server.close();
  }
}

export async function refreshAnthropic(
  credential: OAuthCredential,
  signal?: AbortSignal,
): Promise<OAuthCredential> {
  if (!credential.refreshToken) {
    throw new AIError('Cannot refresh Anthropic OAuth token: no refresh token stored.', {
      code: 'oauth',
      provider: 'anthropic',
    });
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
      refresh_token: credential.refreshToken,
    }),
    signal,
  });

  if (!response.ok) {
    throw new AIError(`Anthropic OAuth token refresh failed with HTTP status ${response.status}`, {
      code: 'oauth',
      provider: 'anthropic',
      status: response.status,
    });
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    type: 'oauth',
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? credential.refreshToken,
    expiresAt: Date.now() + tokenData.expires_in * 1000 - 5 * 60 * 1000,
  };
}

export function toAnthropicAuth(credential: OAuthCredential): ResolvedAuth {
  return {
    type: 'oauth',
    token: credential.accessToken,
    headers: {
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'oauth-2024-11-01',
    },
    source: 'oauth',
  };
}
