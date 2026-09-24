/**
 * @steward/ai - GitHub Copilot Device Code Flow & Session Token Manager
 */

import { pollOAuthDeviceCodeFlow } from '../device-code.js';
import type { AuthInteraction, OAuthCredential, ResolvedAuth } from '../types.js';
import { AIError } from '../../errors.js';

// Decoded GitHub Copilot Client ID: "Iv1.b507a08c87ecfe98"
const CLIENT_ID = 'Iv1.b507a08c87ecfe98';

export const COPILOT_HEADERS = {
  'User-Agent': 'GitHubCopilotChat/0.35.0',
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'Copilot-Integration-Id': 'vscode-chat',
} as const;

export const COPILOT_API_VERSION = '2026-06-01';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval?: number;
  expires_in: number;
}

interface CopilotTokenResponse {
  token: string;
  expires_at: number;
  endpoints?: {
    api?: string;
  };
}

function getBaseUrlFromToken(token: string): string {
  const match = token.match(/proxy-ep=([^;]+)/);
  if (!match) return 'https://api.individual.githubcopilot.com';
  const proxyHost = match[1];
  const apiHost = proxyHost.replace(/^proxy\./, 'api.');
  return `https://${apiHost}`;
}

export async function loginGitHubCopilot(interaction: AuthInteraction): Promise<OAuthCredential> {
  const signal = interaction.signal;

  // 1. Request device code
  let deviceRes: Response;
  try {
    deviceRes = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'GitHubCopilotChat/0.35.0',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: 'read:user',
      }),
      signal,
    });
  } catch (err: any) {
    throw new AIError(`Failed to initiate GitHub device authorization: ${err.message}`, {
      code: 'oauth',
      provider: 'github-copilot',
      cause: err,
    });
  }

  if (!deviceRes.ok) {
    throw new AIError(`GitHub device code request failed (HTTP ${deviceRes.status})`, {
      code: 'oauth',
      provider: 'github-copilot',
    });
  }

  const deviceData = (await deviceRes.json()) as DeviceCodeResponse;
  const { device_code, user_code, verification_uri, interval, expires_in } = deviceData;

  // 2. Notify user with the verification URL and user code
  interaction.notify({
    type: 'device-code',
    userCode: user_code,
    verificationUri: verification_uri,
    expiresInSeconds: expires_in,
  });

  // 3. Poll for the GitHub access token
  const githubAccessToken = await pollOAuthDeviceCodeFlow<string>({
    intervalSeconds: interval,
    expiresInSeconds: expires_in,
    waitBeforeFirstPoll: true,
    signal,
    poll: async () => {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'GitHubCopilotChat/0.35.0',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
        signal,
      });

      const data = (await res.json()) as any;
      if (data?.access_token) {
        return { status: 'complete', value: data.access_token };
      }

      if (data?.error === 'authorization_pending') {
        return { status: 'pending' };
      }

      if (data?.error === 'slow_down') {
        return { status: 'slow_down', intervalSeconds: data.interval };
      }

      return {
        status: 'failed',
        message: data?.error_description || data?.error || 'Authorization failed',
      };
    },
  });

  // 4. Exchange GitHub access token for Copilot session token
  const copilotCreds = await refreshGitHubCopilotToken(githubAccessToken, signal);

  return copilotCreds;
}

export async function refreshGitHubCopilot(
  credential: OAuthCredential,
  signal?: AbortSignal,
): Promise<OAuthCredential> {
  const refreshToken = credential.refreshToken || credential.accessToken;
  return await refreshGitHubCopilotToken(refreshToken, signal);
}

async function refreshGitHubCopilotToken(
  githubAccessToken: string,
  signal?: AbortSignal,
): Promise<OAuthCredential> {
  let res: Response;
  try {
    res = await fetch('https://api.github.com/copilot_internal/v2/token', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${githubAccessToken}`,
        ...COPILOT_HEADERS,
      },
      signal,
    });
  } catch (err: any) {
    throw new AIError(`Failed to fetch Copilot token: ${err.message}`, {
      code: 'oauth',
      provider: 'github-copilot',
      cause: err,
    });
  }

  if (!res.ok) {
    throw new AIError(`GitHub Copilot token exchange failed with HTTP status ${res.status}`, {
      code: 'oauth',
      provider: 'github-copilot',
      status: res.status,
    });
  }

  const data = (await res.json()) as CopilotTokenResponse;
  const sessionToken = data.token;
  const expiresAtMs = (data.expires_at || Math.floor(Date.now() / 1000) + 1800) * 1000;

  return {
    type: 'oauth',
    accessToken: sessionToken,
    refreshToken: githubAccessToken,
    expiresAt: expiresAtMs,
  };
}

export function toGitHubCopilotAuth(credential: OAuthCredential): ResolvedAuth {
  const baseUrl = getBaseUrlFromToken(credential.accessToken);
  return {
    type: 'oauth',
    token: credential.accessToken,
    source: 'oauth',
    headers: {
      ...COPILOT_HEADERS,
      'X-GitHub-Api-Version': COPILOT_API_VERSION,
      'Openai-Intent': 'conversation-edits',
      'X-Initiator': 'agent',
    },
    extra: {
      baseUrl,
    },
  };
}
