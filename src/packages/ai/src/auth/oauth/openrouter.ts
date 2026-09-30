/**
 * @steward/ai - OpenRouter OAuth Adapter
 *
 * Implements PKCE OAuth flow for OpenRouter, minting permanent API keys.
 * Handles the callback via a one-shot loopback server that completes the token
 * exchange before serving the browser page, raced with manual code entry for remote sessions.
 */

import { generatePKCE } from '../pkce.js';
import {
  startOAuthCallbackServer,
  waitForCallbackOrManualInput,
} from '../callback-server.js';
import type { AuthInteraction, OAuthCredential, ResolvedAuth } from '../types.js';
import { AIError } from '../../errors.js';

const AUTHORIZE_URL = 'https://openrouter.ai/auth';
const TOKEN_URL = 'https://openrouter.ai/api/v1/auth/keys';
const CALLBACK_HOST = '127.0.0.1';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
    const errorText = await response.text().catch(() => '');
    throw new AIError(`OpenRouter OAuth key exchange failed with HTTP status ${response.status}: ${errorText}`, {
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
    // OpenRouter keys do not expire
  };
}

export async function loginOpenRouter(interaction: AuthInteraction): Promise<OAuthCredential> {
  const { verifier, challenge } = await generatePKCE();

  const callback = await startOAuthCallbackServer<OAuthCredential>({
    providerName: 'OpenRouter',
    host: CALLBACK_HOST,
    port: 0, // dynamic port
    path: `/oauth/callback/${crypto.randomUUID()}`,
    complete: (code) => exchangeAuthorizationCode(code, verifier, interaction.signal),
    signal: interaction.signal,
    timeoutMs: LOGIN_TIMEOUT_MS,
  });

  try {
    const authorizeUrl = new URL(AUTHORIZE_URL);
    authorizeUrl.search = new URLSearchParams({
      callback_url: callback.redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    interaction.notify({
      type: 'progress',
      message: `Listening for OpenRouter callback on ${callback.redirectUri}`,
    });

    interaction.notify({
      type: 'auth-url',
      url: authorizeUrl.toString(),
      instructions:
        'Complete sign-in in your browser. If the browser is on another machine, paste the redirect URL or code here.',
    });

    const result = await waitForCallbackOrManualInput(interaction, callback, {
      message: 'Complete sign-in in your browser, or paste the authorization code / redirect URL here:',
      placeholder: callback.redirectUri,
    });

    if (result.type === 'callback') {
      return result.value;
    }

    const code = parseAuthorizationInput(result.input);
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
    callback.close();
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
    apiKey: credential.accessToken,
    source: 'oauth',
    headers: {
      'HTTP-Referer': 'https://github.com/sapirrior/steward',
      'X-Title': 'steward',
    },
  };
}
