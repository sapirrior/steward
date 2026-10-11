import type { LanguageModel } from 'ai';
import type { ProviderKeyMetadata } from '../types.js';

/**
 * Provider adapter interface.
 * An adapter is responsible for instantiating an AI SDK LanguageModel
 * using strictly explicit, request-scoped credentials/metadata.
 * Adapters must NEVER access process.env, localStorage, or external stores.
 */
export interface ProviderAdapter {
  readonly id: string;
  readonly aliases?: readonly string[];
  createModel(modelId: string, metadata?: ProviderKeyMetadata): LanguageModel;
}
