/**
 * @steward/ai - Standard API Key Auth helper
 */

import type { ApiKeyAuth, Credential, ResolvedAuth } from './types.js';

export function envApiKeyAuth(envVars: readonly string[]): ApiKeyAuth {
  return {
    envVars,
    resolve: (credential: Credential): ResolvedAuth | undefined => {
      if (credential.type === 'api-key' && credential.key) {
        return { apiKey: credential.key, source: 'stored-credential' };
      }
      return undefined;
    },
  };
}
