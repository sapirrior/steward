/**
 * @steward/ai - Normalized Inference Entry Point & AIEngine (Shim for monorepo consumers)
 */

import type {
  InferenceRequest,
  InferenceStream,
  ModelSelection,
  ProviderId,
  ModelDescriptor,
} from './types.js';
import { AuthManager, createAuthManager } from './auth/manager.js';
import { ModelSelectionRequest, resolveModelSelection } from './models/selection.js';
import { getProviderDescriptor } from './models/registry.js';
import { createAI } from './client.js';
import { builtinProviders } from './providers/index.js';
import { InMemoryCredentialStore } from './auth/memory-store.js';
import { AIError } from './errors.js';

export interface AIEngineOptions {
  auth?: AuthManager;
  customBaseUrl?: string;
}

export interface AIEngine {
  readonly auth: AuthManager;
  stream(request: InferenceRequest): InferenceStream;
  resolveModel(request?: ModelSelectionRequest): Promise<ModelSelection>;
  listModels?(provider?: ProviderId): readonly ModelDescriptor[];
}

export function streamInference(
  request: InferenceRequest,
  authManager: AuthManager = createAuthManager(),
  _customBaseUrl?: string,
): InferenceStream {
  const store = new InMemoryCredentialStore();
  const ai = createAI({
    credentials: store,
    providers: builtinProviders(),
  });

  return ai.stream(request);
}

export class DefaultAIEngine implements AIEngine {
  public readonly auth: AuthManager;
  private readonly customBaseUrl?: string;

  constructor(options?: AIEngineOptions) {
    this.auth = options?.auth ?? createAuthManager();
    this.customBaseUrl = options?.customBaseUrl;
  }

  stream(request: InferenceRequest): InferenceStream {
    return streamInference(request, this.auth, this.customBaseUrl);
  }

  async resolveModel(request?: ModelSelectionRequest): Promise<ModelSelection> {
    return await resolveModelSelection(request, {
      isConfigured: async (provider: ProviderId) => {
        const resolved = await this.auth.resolve(provider);
        return Boolean(resolved);
      },
      getSavedSelection: () => undefined,
      getCustomModelName: () => undefined,
    });
  }

  listModels(provider?: ProviderId): readonly ModelDescriptor[] {
    if (!provider) {
      return [];
    }
    const desc = getProviderDescriptor(provider);
    return [
      {
        id: desc.defaultModel,
        name: desc.defaultModel,
        provider,
        reasoning: desc.reasoning,
      },
    ];
  }
}

export function createAIEngine(options?: AIEngineOptions): AIEngine {
  return new DefaultAIEngine(options);
}
