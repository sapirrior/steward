/**
 * @steward/ai - Auth Resolver
 */

import type { ProviderId } from '../types.js';
import type { CredentialStore, OAuthCredential, ResolvedAuth } from './types.js';
import { refreshAnthropic, toAnthropicAuth } from './oauth/anthropic.js';
import { refreshOpenRouter, toOpenRouterAuth } from './oauth/openrouter.js';
import { refreshGitHubCopilot, toGitHubCopilotAuth } from './oauth/github-copilot.js';
import { AIError } from '../errors.js';

export interface StaticApiKeyProvider {
  getApiKey(provider: ProviderId): string | undefined;
}

export interface AuthResolverOptions {
  store: CredentialStore;
  staticKeys?: StaticApiKeyProvider;
  refreshMarginMs?: number;
}

const DEFAULT_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes

export class AuthResolver {
  private readonly store: CredentialStore;
  private readonly staticKeys?: StaticApiKeyProvider;
  private readonly refreshMarginMs: number;

  constructor(options: AuthResolverOptions) {
    this.store = options.store;
    this.staticKeys = options.staticKeys;
    this.refreshMarginMs = options.refreshMarginMs ?? DEFAULT_REFRESH_MARGIN_MS;
  }

  public async resolve(
    provider: ProviderId,
    signal?: AbortSignal,
  ): Promise<ResolvedAuth | undefined> {
    // 1. Check stored OAuth credentials
    const stored = await this.store.read(provider);

    if (stored) {
      // Check expiry
      const now = Date.now();
      const expiresAt = stored.expiresAt ?? Number.POSITIVE_INFINITY;

      if (expiresAt - now > this.refreshMarginMs) {
        // Still valid
        return this.formatOAuth(provider, stored);
      }

      // Expired or near expiry -> double-checked serialized refresh
      const refreshed = await this.store.modify(provider, async (current) => {
        if (!current) return undefined;
        const currentExp = current.expiresAt ?? Number.POSITIVE_INFINITY;
        if (currentExp - Date.now() > this.refreshMarginMs) {
          // Already refreshed by concurrent caller
          return current;
        }

        // Perform refresh
        return await this.performRefresh(provider, current, signal);
      });

      if (!refreshed) {
        throw new AIError(`Failed to refresh OAuth credential for ${provider}`, {
          code: 'oauth',
          provider,
        });
      }

      return this.formatOAuth(provider, refreshed);
    }

    // 2. Fallback to static API keys if no OAuth credential stored
    const staticKey = this.staticKeys?.getApiKey(provider);
    if (staticKey) {
      return {
        type: 'api-key',
        token: staticKey,
        source: 'api-key',
      };
    }

    return undefined;
  }

  private async performRefresh(
    provider: ProviderId,
    credential: OAuthCredential,
    signal?: AbortSignal,
  ): Promise<OAuthCredential> {
    if (provider === 'anthropic') {
      return await refreshAnthropic(credential, signal);
    }
    if (provider === 'openrouter') {
      return await refreshOpenRouter(credential, signal);
    }
    if (provider === 'github-copilot') {
      return await refreshGitHubCopilot(credential, signal);
    }
    return credential;
  }

  private formatOAuth(provider: ProviderId, credential: OAuthCredential): ResolvedAuth {
    if (provider === 'anthropic') {
      return toAnthropicAuth(credential);
    }
    if (provider === 'openrouter') {
      return toOpenRouterAuth(credential);
    }
    if (provider === 'github-copilot') {
      return toGitHubCopilotAuth(credential);
    }
    return {
      type: 'oauth',
      token: credential.accessToken,
      source: 'oauth',
    };
  }
}
