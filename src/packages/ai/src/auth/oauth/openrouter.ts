/**
 * @steward/ai - OpenRouter OAuth Adapter
 */

import { generatePKCE } from '../pkce.js';
import { startOAuthCallbackServer } from '../callback-server.js';
import type { AuthInteraction, OAuthCredential, ResolvedAuth } from '../types.js';
import { AIError } from '../../errors.js';

const AUTHORIZE_URL = 'https://openrouter.ai/auth';
const TOKEN_URL = 'https://openrouter.ai/api/v1/auth/keys';
const CALLBACK_HOST = '127.0.0.1';
const CALLBACK_PORT = 8085;
const CALLBACK_PATH = '/oauth/callback';
const REDIRECT_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;

function parseAuthorizationInput(input: string): string | undefined {
  const value = input.trim();
  if (!value) return undefined;

  try {
    return new URL(value).searchParams.get('code') ?? undefined;
  } catch {
    // not a URL
  }

  if (value.includes('code=')) {
    return new URLSearchParams(value).get('code') ?? undefined;
  }

  return value;
}

async function exchangeAuthorizationCode(
  code: string,
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
      code,
      code_verifier: verifier,
      code_challenge_method: 'S256',
    }),
    signal,
  });

  if (!response.ok) {
    throw new AIError(`OpenRouter OAuth key exchange failed with HTTP status ${response.status}`, {
      code: 'oauth',
      provider: 'openrouter',
      status: response.status,
    });
  }

  const body = (await response.json()) as { key?: string };
  if (!body.key || typeof body.key !== 'string') {
    throw new AIError('OpenRouter OAuth response did not contain an API key.', {
      code: 'oauth',
      provider: 'openrouter',
    });
  }

  return {
    type: 'oauth',
    accessToken: body.key,
    expiresAt: Number.POSITIVE_INFINITY,
  };
}

export async function loginOpenRouter(interaction: AuthInteraction): Promise<OAuthCredential> {
  const { verifier, challenge } = await generatePKCE();
  const server = await startOAuthCallbackServer({
    host: '127.0.0.1',
    port: CALLBACK_PORT,
    path: CALLBACK_PATH,
    signal: interaction.signal,
  });

  const manualAbort = new AbortController();

  try {
    const authorizeUrl = new URL(AUTHORIZE_URL);
    authorizeUrl.search = new URLSearchParams({
      callback_url: server.redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    interaction.notify({
      type: 'auth-url',
      url: authorizeUrl.toString(),
      instructions:
        'Complete sign-in in your browser. If on another device, paste the redirect URL or code here.',
    });

    let manualInput: string | undefined;
    const manualPromise = interaction
      .prompt({
        type: 'manual-code',
        message:
          'Complete sign-in in your browser, or paste the authorization code / redirect URL here:',
        placeholder: server.redirectUri,
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
    if (result && result.code) {
      code = result.code;
    } else if (manualInput) {
      code = parseAuthorizationInput(manualInput);
    }

    if (!code) {
      throw new AIError('Missing authorization code for OpenRouter OAuth.', {
        code: 'oauth',
        provider: 'openrouter',
      });
    }

    interaction.notify({
      type: 'progress',
      message: 'Exchanging authorization code for an API key...',
    });

    return await exchangeAuthorizationCode(code, verifier, interaction.signal);
  } finally {
    manualAbort.abort();
    await server.close();
  }
}

export async function refreshOpenRouter(
  credential: OAuthCredential,
  _signal?: AbortSignal,
): Promise<OAuthCredential> {
  return credential;
}

export function toOpenRouterAuth(credential: OAuthCredential): ResolvedAuth {
  return {
    type: 'oauth',
    token: credential.accessToken,
    headers: {
      'HTTP-Referer': 'https://github.com/sapirrior/steward',
      'X-Title': 'steward',
    },
    source: 'oauth',
  };
}
