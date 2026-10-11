import type { LanguageModel } from 'ai';
import { StewardSDKError } from '../errors.js';
import type { ProviderKeyMetadata } from '../types.js';
import { defaultAdapters } from './defaults.js';
import type { ProviderAdapter } from './types.js';

export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();
  private readonly aliasMap = new Map<string, string>();

  constructor(additionalProviders?: readonly ProviderAdapter[]) {
    // 1. Register default adapters
    for (const adapter of defaultAdapters) {
      this.registerAdapter(adapter);
    }

    // 2. Register additional injected adapters
    if (additionalProviders) {
      for (const adapter of additionalProviders) {
        this.registerAdapter(adapter);
      }
    }
  }

  private registerAdapter(adapter: ProviderAdapter): void {
    const id = adapter.id.toLowerCase();
    if (this.adapters.has(id)) {
      throw new StewardSDKError({
        kind: 'invalid-input',
        message: `Duplicate provider registration: provider '${id}' is already registered.`,
        retryable: false,
        provider: id,
      });
    }

    this.adapters.set(id, adapter);

    if (adapter.aliases) {
      for (const alias of adapter.aliases) {
        const lowerAlias = alias.toLowerCase();
        if (this.adapters.has(lowerAlias) || this.aliasMap.has(lowerAlias)) {
          throw new StewardSDKError({
            kind: 'invalid-input',
            message: `Duplicate provider alias registration: alias '${lowerAlias}' conflicts with an existing provider or alias.`,
            retryable: false,
            provider: lowerAlias,
          });
        }
        this.aliasMap.set(lowerAlias, id);
      }
    }
  }

  /**
   * Resolves a provider by ID or alias, and returns the instantiated LanguageModel.
   */
  resolve(providerId: string, modelId: string, metadata?: ProviderKeyMetadata): LanguageModel {
    const lower = providerId.toLowerCase();
    const canonicalId = this.aliasMap.get(lower) ?? lower;
    const adapter = this.adapters.get(canonicalId);

    if (!adapter) {
      const knownProviders = Array.from(this.adapters.keys()).sort().join(', ');
      throw new StewardSDKError({
        kind: 'invalid-input',
        message: `Unknown provider '${providerId}'. Known providers: ${knownProviders}`,
        retryable: false,
        provider: providerId,
        modelId,
      });
    }

    return adapter.createModel(modelId, metadata);
  }

  /**
   * Returns list of all registered canonical provider IDs.
   */
  getRegisteredProviderIds(): string[] {
    return Array.from(this.adapters.keys()).sort();
  }
}
