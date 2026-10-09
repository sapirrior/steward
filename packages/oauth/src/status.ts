import { readAuthStore } from './store.js';
import type { AuthStatus } from './types.js';

const KNOWN_PROVIDERS = ['openrouter', 'github-copilot'] as const;

/**
 * Returns safe authentication status for all configured and known providers.
 * Guaranteed never to expose token secrets.
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const store = await readAuthStore();
  const status: AuthStatus = {};

  // Populate known providers defaults
  for (const provider of KNOWN_PROVIDERS) {
    status[provider] = {
      loggedIn: false,
    };
  }

  // Populate actual store state
  for (const [provider, record] of Object.entries(store)) {
    const isExpired = record.expires ? Date.now() > record.expires : false;
    status[provider] = {
      loggedIn: !isExpired,
      type: record.type,
      expiresAt: record.expires,
      account: record.account,
    };
  }

  return status;
}
