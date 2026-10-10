import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import { AgentError } from '../errors/AgentError.js';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class CustomProvider implements ModelProvider {
  readonly id = 'custom';
  readonly displayName = 'Custom (OpenAI-Compatible)';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'custom';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const baseURL = options?.baseURL || process.env.CUSTOM_BASE_URL || process.env.OPENAI_BASE_URL;
    const apiKey =
      options?.apiKey || process.env.CUSTOM_API_KEY || process.env.OPENAI_API_KEY || 'custom-key';

    if (!baseURL) {
      throw new AgentError({
        code: 'AUTH_MISSING',
        message:
          "Custom provider requires a baseURL. Set 'CUSTOM_BASE_URL' in environment or pass in options.",
        provider: 'custom',
        modelId: ref.modelId,
        retryable: false,
      });
    }

    const custom = createOpenAICompatible({
      name: 'custom',
      baseURL,
      apiKey,
    });

    return custom(ref.modelId);
  }
}
