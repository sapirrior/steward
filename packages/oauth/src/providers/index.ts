import { registerTokenRefresher } from '../refresh.js';
import { saveStoredToken, deleteStoredToken } from '../store.js';
import { OAuthError } from '../errors.js';
import type { LoginOptions, LoginResult, TokenRecord } from '../types.js';

import { loginAnthropic, refreshAnthropic } from './anthropic.js';
import { loginOpenRouter, refreshOpenRouter } from './openrouter.js';
import { loginGitHubCopilot, refreshGitHubCopilot } from './github-copilot.js';

// Auto-register token refresh handlers
registerTokenRefresher('anthropic', refreshAnthropic);
registerTokenRefresher('openrouter', refreshOpenRouter);
registerTokenRefresher('github-copilot', refreshGitHubCopilot);

export type ProviderLoginHandler = (options?: LoginOptions) => Promise<TokenRecord>;

const loginHandlers: Record<string, ProviderLoginHandler> = {
  anthropic: loginAnthropic,
  openrouter: loginOpenRouter,
  'github-copilot': loginGitHubCopilot,
};

/**
 * Initiates login for a supported OAuth provider, saves the resulting credentials,
 * and returns the LoginResult.
 */
export async function executeProviderLogin(
  provider: string,
  options?: LoginOptions,
): Promise<LoginResult> {
  const handler = loginHandlers[provider];
  if (!handler) {
    return {
      provider,
      success: false,
      error: `Unsupported OAuth provider: "${provider}". Supported: anthropic, openrouter, github-copilot`,
    };
  }

  try {
    const token = await handler(options);
    await saveStoredToken(provider, token);
    return {
      provider,
      success: true,
      account: token.account,
    };
  } catch (err: any) {
    if (err instanceof OAuthError) {
      return {
        provider,
        success: false,
        error: err.message,
      };
    }
    return {
      provider,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
