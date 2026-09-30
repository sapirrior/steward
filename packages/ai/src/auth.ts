/**
 * @steward/ai - API Key Auth Resolution
 *
 * Pure auth resolver: resolves credentials from request override -> options -> callback -> env -> keyless.
 * No filesystem I/O, no OAuth flows.
 */

import { AIError } from './errors.js';
import type { Provider } from './client.js';

export type AuthSource = 'request' | 'option' | 'callback' | 'env' | 'keyless';
export type AuthScheme = 'x-api-key' | 'bearer' | 'x-goog-api-key';

export interface ResolvedAuth {
  apiKey?: string;
  headers?: Record<string, string>;
  baseUrl?: string;
  source?: AuthSource;
  scheme?: AuthScheme;
}

export type AuthEnvGetter = (name: string) => string | undefined;

export interface AuthOptions {
  apiKeys?: Record<string, string | undefined>;
  getApiKey?: (providerId: string) => string | Promise<string | undefined> | undefined;
  env?: AuthEnvGetter;
}

/**
 * Default environment variable reader (pure globalThis check).
 */
export function defaultEnvGetter(name: string): string | undefined {
  if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
    return (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env?.[name];
  }
  return undefined;
}

/**
 * Resolve an API key for a provider in strict priority order:
 * 1. Request override (`requestApiKey`)
 * 2. Explicit options (`options.apiKeys[provider.id]`)
 * 3. Dynamic callback (`options.getApiKey(provider.id)`)
 * 4. Provider environment variables (`options.env(varName)`)
 * 5. Keyless provider (`provider.keyless === true`)
 *
 * Throws AIError({ code: 'auth' }) if unresolvable.
 */
export async function resolveApiKey(
  provider: Provider,
  options: AuthOptions = {},
  requestApiKey?: string,
): Promise<ResolvedAuth> {
  const scheme = provider.authScheme;
  const baseUrl = provider.baseUrl;

  // 1. Request override
  if (requestApiKey) {
    return {
      apiKey: requestApiKey,
      source: 'request',
      scheme,
      baseUrl,
    };
  }

  // 2. Explicit options
  if (options.apiKeys && options.apiKeys[provider.id]) {
    return {
      apiKey: options.apiKeys[provider.id]!,
      source: 'option',
      scheme,
      baseUrl,
    };
  }

  // 3. Dynamic callback
  if (options.getApiKey) {
    const key = await options.getApiKey(provider.id);
    if (key) {
      return {
        apiKey: key,
        source: 'callback',
        scheme,
        baseUrl,
      };
    }
  }

  // 4. Environment variables
  const envFn = options.env ?? defaultEnvGetter;
  const envVars = provider.envVars ?? [];
  for (const envVar of envVars) {
    const val = envFn(envVar);
    if (val) {
      return {
        apiKey: val,
        source: 'env',
        scheme,
        baseUrl,
      };
    }
  }

  // 5. Keyless
  if (provider.keyless) {
    return {
      apiKey: '',
      source: 'keyless',
      scheme,
      baseUrl,
    };
  }

  const envHint = envVars.length > 0 ? ` (expected env: ${envVars.join(', ')})` : '';
  throw new AIError(`No API key configured for provider "${provider.id}"${envHint}`, {
    code: 'auth',
    provider: provider.id,
  });
}
