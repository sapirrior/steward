import { pollOAuthDeviceCodeFlow } from '../utils/device-poller.js';
import { launchBrowser } from '../utils/browser.js';
import { OAuthError } from '../errors.js';
import type { LoginOptions, TokenRecord } from '../types.js';

const CLIENT_ID = 'Iv1.b507a08c87ecfe98';

export const COPILOT_HEADERS = {
  'User-Agent': 'GitHubCopilotChat/0.35.0',
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'Copilot-Integration-Id': 'vscode-chat',
} as const;

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
}

export async function loginGitHubCopilot(options?: LoginOptions): Promise<TokenRecord> {
  const signal = options?.signal;

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
  } catch (err: unknown) {
    throw new OAuthError(
      `Failed to initiate GitHub device authorization: ${err instanceof Error ? err.message : String(err)}`,
      'oauth',
      'github-copilot',
      err,
    );
  }

  if (!deviceRes.ok) {
    throw new OAuthError(
      `GitHub device code request failed (HTTP ${deviceRes.status})`,
      'oauth',
      'github-copilot',
    );
  }

  const deviceData = (await deviceRes.json()) as DeviceCodeResponse;
  const { device_code, user_code, verification_uri, interval, expires_in } = deviceData;
  if (options?.onDeviceCode) {
    options.onDeviceCode({
      userCode: user_code,
      verificationUri: verification_uri,
      expiresIn: expires_in,
      interval: interval || 5,
    });
  }
  await launchBrowser(verification_uri);

  const githubAccessToken = await pollOAuthDeviceCodeFlow<string>({
    providerName: 'github-copilot',
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

      const data = (await res.json()) as Record<string, unknown>;
      if (typeof data?.access_token === 'string') {
        return { status: 'complete', value: data.access_token };
      }

      if (data?.error === 'authorization_pending') {
        return { status: 'pending' };
      }

      if (data?.error === 'slow_down') {
        return {
          status: 'slow_down',
          intervalSeconds: typeof data.interval === 'number' ? data.interval : undefined,
        };
      }

      return {
        status: 'failed',
        message:
          typeof data?.error_description === 'string'
            ? data.error_description
            : typeof data?.error === 'string'
              ? data.error
              : 'Authorization failed',
      };
    },
  });

  return await refreshGitHubCopilotToken(githubAccessToken, signal);
}

export async function refreshGitHubCopilot(
  token: TokenRecord,
  signal?: AbortSignal,
): Promise<TokenRecord> {
  const refreshToken = token.refresh || token.access;
  return await refreshGitHubCopilotToken(refreshToken, signal);
}

async function refreshGitHubCopilotToken(
  githubAccessToken: string,
  signal?: AbortSignal,
): Promise<TokenRecord> {
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
  } catch (err: unknown) {
    throw new OAuthError(
      `Failed to fetch Copilot token: ${err instanceof Error ? err.message : String(err)}`,
      'oauth',
      'github-copilot',
      err,
    );
  }

  if (!res.ok) {
    const err: any = new OAuthError(
      `GitHub Copilot token exchange failed with HTTP status ${res.status}`,
      'oauth',
      'github-copilot',
    );
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as CopilotTokenResponse;
  const sessionToken = data.token;
  const expiresAtMs = (data.expires_at || Math.floor(Date.now() / 1000) + 1800) * 1000;

  return {
    type: 'oauth',
    access: sessionToken,
    refresh: githubAccessToken,
    expires: expiresAtMs,
  };
}
