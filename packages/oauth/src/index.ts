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

import { ensureAuthDir, deleteStoredToken } from './store.js';
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
export async function logout(provider: string): Promise<void> {
  await deleteStoredToken(provider);
}


/**
 * Returns safe public authentication status for all configured providers.
 * Guaranteed never to expose token secrets.
 */
export async function authStatus(): Promise<import('./types').AuthStatus> {
  // Implemented in subsequent steps
  return {};
}

/**
 * Cross-platform helper to launch authorization URLs in the user's default browser.
 */
export async function launch(url: string): Promise<void> {
  // Implemented in subsequent steps
}
