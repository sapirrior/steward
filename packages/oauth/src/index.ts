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

/**
 * Initializes the auth storage directory with owner-only permissions.
 * Safe and idempotent to call on startup.
 */
export async function setupAuth(): Promise<void> {
  // Implemented in subsequent steps
}

/**
 * Retrieves a valid, unexpired token for the specified provider.
 * Automatically refreshes the token if close to expiry.
 * Returns null if no credentials exist or refresh failed.
 */
export async function getToken(provider: string): Promise<string | null> {
  // Implemented in subsequent steps
  return null;
}

/**
 * Initiates interactive OAuth login for the specified provider.
 */
export async function login(provider: string, options?: import('./types').LoginOptions): Promise<import('./types').LoginResult> {
  // Implemented in subsequent steps
  return { provider, success: false, error: 'Not implemented' };
}

/**
 * Logs out and removes credentials for the specified provider.
 */
export async function logout(provider: string): Promise<void> {
  // Implemented in subsequent steps
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
