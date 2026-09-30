/**
 * @steward/ai - Google OAuth Adapter
 */

import { generatePKCE } from '../pkce.js';
import { startOAuthCallbackServer } from '../callback-server.js';
import type { AuthInteraction, OAuthCredential, ResolvedAuth } from '../types.js';
import { AIError } from '../../errors.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALLBACK_HOST = '127.0.0.1';
const CALLBACK_PORT = 8086;
const CALLBACK_PATH = '/oauth/callback';

// Default Google OAuth Client ID for desktop/CLI apps (can be overridden via env)
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  '681185966442-gvd10qffk0ngq9a3l68lffu5s3t35i47.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

const SCOPES = [
  'https://www.googleapis.com/auth/generative-language',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

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
  redirectUri: string,
  signal?: AbortSignal,
): Promise<OAuthCredential> {
  const bodyParams: Record<string, string> = {
    client_id: GOOGLE_CLIENT_ID,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };
  if (GOOGLE_CLIENT_SECRET) {
    bodyParams.client_secret = GOOGLE_CLIENT_SECRET;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(bodyParams).toString(),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new AIError(`Google OAuth token exchange failed with HTTP status ${response.status}: ${errorText}`, {
      code: 'oauth',
      provider: 'google',
      status: response.status,
    });
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!body.access_token) {
    throw new AIError('Google OAuth response did not contain an access token.', {
      code: 'oauth',
      provider: 'google',
    });
  }

  const expiresAt = body.expires_in
    ? Date.now() + Math.max(0, body.expires_in - 300) * 1000
    : Date.now() + 3300 * 1000;

  return {
    type: 'oauth',
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt,
  };
}

export async function loginGoogle(interaction: AuthInteraction): Promise<OAuthCredential> {
  const { verifier, challenge } = await generatePKCE();
  const server = await startOAuthCallbackServer({
    host: CALLBACK_HOST,
    port: CALLBACK_PORT,
    path: CALLBACK_PATH,
    signal: interaction.signal,
  });

  const manualAbort = new AbortController();

  try {
    const authorizeUrl = new URL(AUTHORIZE_URL);
    authorizeUrl.search = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: server.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

    interaction.notify({
      type: 'auth-url',
      url: authorizeUrl.toString(),
      instructions:
        'Complete sign-in in your browser. If on another device, paste the redirect URL or code here.',
    });

    const manualInputPromise = interaction
      .prompt({
        type: 'url',
        url: authorizeUrl.toString(),
        message: 'Google Sign-In URL:',
      })
      .then(async (answer) => {
        const parsedCode = parseAuthorizationInput(answer);
        if (!parsedCode) {
          throw new AIError('Invalid or empty authorization code provided.', {
            code: 'oauth',
            provider: 'google',
          });
        }
        return exchangeAuthorizationCode(parsedCode, verifier, server.redirectUri, interaction.signal);
      });

    const serverCallbackPromise = server
      .waitForCallback(manualAbort.signal)
      .then(async ({ code }) => {
        return exchangeAuthorizationCode(code, verifier, server.redirectUri, interaction.signal);
      });

    const credential = await Promise.race([serverCallbackPromise, manualInputPromise]);
    manualAbort.abort();
    return credential;
  } finally {
    await server.close();
  }
}

export async function refreshGoogle(
  credential: OAuthCredential,
  signal?: AbortSignal,
): Promise<OAuthCredential> {
  if (!credential.refreshToken) {
    throw new AIError('Cannot refresh Google OAuth token without a refresh token.', {
      code: 'oauth',
      provider: 'google',
    });
  }

  const bodyParams: Record<string, string> = {
    client_id: GOOGLE_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: credential.refreshToken,
  };
  if (GOOGLE_CLIENT_SECRET) {
    bodyParams.client_secret = GOOGLE_CLIENT_SECRET;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(bodyParams).toString(),
    signal,
  });

  if (!response.ok) {
    throw new AIError(`Google OAuth token refresh failed with HTTP ${response.status}`, {
      code: 'oauth',
      provider: 'google',
      status: response.status,
    });
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token) {
    throw new AIError('Google refresh did not return a valid access token.', {
      code: 'oauth',
      provider: 'google',
    });
  }

  const expiresAt = body.expires_in
    ? Date.now() + Math.max(0, body.expires_in - 300) * 1000
    : Date.now() + 3300 * 1000;

  return {
    type: 'oauth',
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? credential.refreshToken,
    expiresAt,
  };
}

export function toGoogleAuth(credential: OAuthCredential): ResolvedAuth {
  return {
    apiKey: credential.accessToken,
    headers: {
      Authorization: `Bearer ${credential.accessToken}`,
    },
    source: 'oauth',
  };
}
