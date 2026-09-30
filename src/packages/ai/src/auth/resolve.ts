/**
 * @steward/ai - Central Auth Resolution with Double-Checked OAuth Refresh
 *
 * Contract:
 * - Stored credential owns the provider (ambient env is checked only if no stored credential).
 * - Double-checked locking under store.modify() ensures only 1 concurrent refresh runs.
 * - 5-minute expiry margin is evaluated in resolver, not stored double.
 * - fn returning undefined in modify() leaves the credential unchanged.
 */

import { AIError } from '../errors.js';
import type { ProviderId } from '../types.js';
import type {
  AuthContext,
  Credential,
  CredentialStore,
  OAuthAuth,
  OAuthCredential,
  ProviderAuth,
  ResolvedAuth,
} from './types.js';

export interface ResolveAuthOptions {
  minOAuthValidityMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_OAUTH_MINIMUM_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_OAUTH_REFRESH_TIMEOUT_MS = 15_000;        // 15 seconds

export async function resolveAuth(
  provider: { id: ProviderId; auth: ProviderAuth; baseUrl?: string },
  store: CredentialStore,
  context?: AuthContext,
  options?: ResolveAuthOptions,
): Promise<ResolvedAuth> {
  const signal = options?.signal;
  if (signal?.aborted) {
    throw new AIError('Auth resolution aborted', { code: 'aborted', provider: provider.id });
  }

  // 1. Stored credential wins
  const stored = await store.read(provider.id);
  if (stored) {
    if (stored.type === 'oauth' && provider.auth.oauth) {
      return resolveStoredOAuth(
        provider.id,
        provider.auth.oauth,
        stored,
        store,
        signal,
        options?.minOAuthValidityMs,
      );
    }
    if (stored.type === 'api-key' && provider.auth.apiKey) {
      const resolved = provider.auth.apiKey.resolve(stored);
      if (resolved) return resolved;
    }
    throw new AIError(`Unsupported stored credential type for provider ${provider.id}`, {
      code: 'auth',
      provider: provider.id,
    });
  }

  // 2. Ambient environment variables via injected AuthContext
  if (context && provider.auth.apiKey) {
    for (const envVar of provider.auth.apiKey.envVars) {
      const val = context.env(envVar);
      if (val) {
        return { apiKey: val, source: `env:${envVar}` };
      }
    }
  }

  // 3. Keyless provider fallback (e.g. local keyless server, test mock)
  if (provider.auth.apiKey) {
    const keyless = provider.auth.apiKey.resolve({ type: 'api-key', key: '' });
    if (keyless) return keyless;
  }

  throw new AIError(`No credentials configured for provider ${provider.id}`, {
    code: 'auth',
    provider: provider.id,
  });
}

async function resolveStoredOAuth(
  providerId: ProviderId,
  oauth: OAuthAuth,
  stored: OAuthCredential,
  store: CredentialStore,
  signal?: AbortSignal,
  minOAuthValidityMs?: number,
): Promise<ResolvedAuth> {
  const minValidity = Math.max(DEFAULT_OAUTH_MINIMUM_VALIDITY_MS, minOAuthValidityMs ?? 0);
  const expiresSoon = (c: OAuthCredential) =>
    c.expiresAt !== undefined && Date.now() + minValidity >= c.expiresAt;

  let cred = stored;

  if (expiresSoon(cred)) {
    // Double-checked locking under serialized modify
    try {
      const updated = await store.modify(providerId, async (current) => {
        if (current?.type !== 'oauth') return undefined; // logged out meanwhile
        if (!expiresSoon(current)) return undefined;      // already refreshed by another concurrent request

        const timeoutController = new AbortController();
        const timer = setTimeout(() => timeoutController.abort(), DEFAULT_OAUTH_REFRESH_TIMEOUT_MS);
        const combinedSignal = signal
          ? AbortSignal.any([signal, timeoutController.signal])
          : timeoutController.signal;

        try {
          const refreshed = await oauth.refresh(current, combinedSignal);
          return refreshed;
        } finally {
          clearTimeout(timer);
        }
      });

      if (updated && updated.type === 'oauth') {
        cred = updated;
      } else {
        const latest = await store.read(providerId);
        if (latest && latest.type === 'oauth') {
          cred = latest;
        }
      }
    } catch (err) {
      throw new AIError(`OAuth refresh failed for provider ${providerId}`, {
        code: 'oauth',
        provider: providerId,
        cause: err,
      });
    }

    if (minOAuthValidityMs !== undefined && expiresSoon(cred)) {
      throw new AIError(`OAuth refresh returned a token that expires too soon for ${providerId}`, {
        code: 'oauth',
        provider: providerId,
      });
    }
  }

  try {
    return oauth.toAuth(cred);
  } catch (err) {
    throw new AIError(`OAuth auth derivation failed for ${providerId}`, {
      code: 'oauth',
      provider: providerId,
      cause: err,
    });
  }
}
