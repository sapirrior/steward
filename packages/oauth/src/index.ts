export type {
  OAuthProviderId,
  DeviceCodePrompt,
  LoginOptions,
  LoginResult,
  ProviderAuthStatus,
  AuthStatus,
  TokenRecord,
  AuthStoreData,
} from './types';

import { ensureAuthDir, deleteStoredToken, clearStoredTokens } from './store.js';
import { getOrRefreshToken } from './refresh.js';

export { registerTokenRefresher } from './refresh.js';

/**
 * Initializes the auth storage directory with owner-only permissions.
 * Safe and idempotent to call on startup.
 */
export async function setupAuth(): Promise<void> {
  await ensureAuthDir();
}

/**
 * Retrieves a valid, unexpired token for the specified provider.
 * Automatically refreshes the token if close to expiry.
 * Returns null if no credentials exist or refresh failed.
 */
export async function getToken(provider: string, signal?: AbortSignal): Promise<string | null> {
  return getOrRefreshToken(provider, signal);
}


import { executeProviderLogin } from './providers/index.js';

/**
 * Initiates interactive OAuth login for the specified provider.
 */
export async function login(
  provider: string,
  options?: import('./types').LoginOptions,
): Promise<import('./types').LoginResult> {
  return executeProviderLogin(provider, options);
}

/**
 * Logs out and removes credentials for the specified provider.
 */
export async function logout(provider: string): Promise<boolean> {
  return deleteStoredToken(provider);
}

/**
 * Logs out and removes credentials for all providers.
 */
export async function logoutAll(): Promise<number> {
  return clearStoredTokens();
}


import { getAuthStatus } from './status.js';
import { launchBrowser } from './utils/browser.js';

/**
 * Returns safe public authentication status for all configured providers.
 * Guaranteed never to expose token secrets.
 */
export async function authStatus(): Promise<import('./types').AuthStatus> {
  return getAuthStatus();
}

/**
 * Cross-platform helper to launch authorization URLs in the user's default browser.
 */
export async function launch(url: string): Promise<void> {
  await launchBrowser(url);
}

