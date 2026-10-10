import type { LanguageModel } from 'ai';
import { parseModelRef, type ModelRef } from '@steward/models';
import { AgentError } from '../errors/AgentError.js';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { GoogleProvider } from './googleProvider.js';
import { OpenRouterProvider } from './openRouterProvider.js';
import { CopilotProvider } from './copilotProvider.js';
import { DeepSeekProvider } from './deepseekProvider.js';
import { MistralProvider } from './mistralProvider.js';
import { GroqProvider } from './groqProvider.js';
import { XaiProvider } from './xaiProvider.js';
import { OllamaProvider } from './ollamaProvider.js';
import { CustomProvider } from './customProvider.js';

export interface ResolvedModel {
  provider: ModelProvider;
  ref: ModelRef;
  model: LanguageModel;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, ModelProvider>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new AnthropicProvider());
    this.register(new OpenAIProvider());
    this.register(new GoogleProvider());
    this.register(new OpenRouterProvider());
    this.register(new CopilotProvider());
    this.register(new DeepSeekProvider());
    this.register(new MistralProvider());
    this.register(new GroqProvider());
    this.register(new XaiProvider());
    this.register(new OllamaProvider());
    this.register(new CustomProvider());
  }

  /**
   * Registers a ModelProvider (Open-Closed Principle: extensible for any new provider).
   */
  register(provider: ModelProvider): void {
    this.providers.set(provider.id.toLowerCase(), provider);
  }

  /**
   * Returns all registered providers.
   */
  getRegisteredProviders(): readonly ModelProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Finds a provider capable of handling the specified ModelRef.
   */
  findProvider(ref: ModelRef): ModelProvider | undefined {
    // 1. Direct key match
    const direct = this.providers.get(ref.provider.toLowerCase());
    if (direct?.canHandle(ref)) {
      return direct;
    }

    // 2. Iterate all registered providers (in case of alias or custom logic)
    for (const provider of this.providers.values()) {
      if (provider.canHandle(ref)) {
        return provider;
      }
    }

    return undefined;
  }

  /**
   * Resolves a ModelRef or "provider/modelId" string into a concrete LanguageModel.
   */
  async resolve(
    modelInput: ModelRef | string,
    options?: ResolveModelOptions,
  ): Promise<ResolvedModel> {
    let ref: ModelRef | undefined;

    if (typeof modelInput === 'string') {
      ref = parseModelRef(modelInput);
      if (!ref) {
        throw new AgentError({
          code: 'UNKNOWN',
          message: `Invalid model format '${modelInput}'. Expected format: 'provider/modelId' (e.g. 'anthropic/claude-3-7-sonnet-20250219').`,
          retryable: false,
        });
      }
    } else {
      ref = modelInput;
    }

    const provider = this.findProvider(ref);
    if (!provider) {
      throw new AgentError({
        code: 'UNKNOWN',
        message: `No provider registered to handle '${ref.provider}'. Available providers: ${Array.from(this.providers.keys()).join(', ')}`,
        provider: ref.provider,
        modelId: ref.modelId,
        retryable: false,
      });
    }

    const model = await provider.resolveModel(ref, options);

    return {
      provider,
      ref,
      model,
    };
  }
}
